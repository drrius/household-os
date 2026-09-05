-- Depends on the attachment reservation/claim registry from PR 44 (a938fd4).
-- Connected documents are pre-release. Before applying to an installation with
-- existing documents, backfill their registry/storage records and mark them
-- claimed; this migration never invents successful uploads for missing files.

create index financial_events_lineage_idx
  on public.financial_events(household_id, related_event_id)
  where related_event_id is not null;

create function public.read_household_cost_context(
  p_context_kind text,
  p_context_id uuid,
  p_page_size integer default 30,
  p_before_on date default null,
  p_before_id uuid default null,
  p_booking_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tenant uuid;
  result jsonb;
begin
  if p_context_kind is null or p_context_kind not in ('project','asset','commitment')
    or p_context_id is null or p_page_size is null or p_page_size < 1 or p_page_size > 100
    or (p_before_on is null) <> (p_before_id is null)
  then raise exception 'Invalid cost context or page' using errcode = '22023'; end if;

  case p_context_kind
    when 'project' then select household_id into tenant from public.household_projects where id=p_context_id;
    when 'asset' then select household_id into tenant from public.household_assets where id=p_context_id;
    when 'commitment' then select household_id into tenant from public.household_commitments where id=p_context_id;
  end case;
  if auth.uid() is null or tenant is null or not private.is_household_member(tenant)
  then raise exception 'Cost context unavailable' using errcode = '42501'; end if;
  if p_booking_id is not null and (p_context_kind <> 'project' or not exists(
    select 1 from public.trip_bookings b where b.household_id=tenant
      and b.project_id=p_context_id and b.id=p_booking_id
  )) then raise exception 'Booking does not belong to this project' using errcode = '22023'; end if;

  -- Append-only history forms a forest: related events must already exist when
  -- posted. Context follows the nearest active expense/replacement association.
  -- A replacement may choose a new context; the original's reversal stays with
  -- the original. Reversing a refund contributes the inverse of that refund.
  with recursive own_events as materialized (
    select e.* from public.financial_events e where e.household_id=tenant
  ), active_links as materialized (
    select l.financial_event_id,l.id as link_id,
      case when l.project_id is not null then 'project'
        when l.asset_id is not null then 'asset' else 'commitment' end as kind,
      coalesce(l.project_id,l.asset_id,l.commitment_id) as context_id,l.booking_id
    from public.household_financial_links l
    where l.household_id=tenant and l.archived_at is null
  ), lineage as (
    select e.id,
      case e.type when 'expense' then e.amount_cents::numeric else 0::numeric end as signed_cents,
      l.kind,l.context_id,l.booking_id,l.link_id,l.financial_event_id as linked_event_id
    from own_events e left join active_links l on l.financial_event_id=e.id
    where e.related_event_id is null
    union all
    select child.id,
      case child.type when 'replacement' then child.amount_cents::numeric
        when 'refund' then -child.amount_cents::numeric
        when 'reversal' then -parent.signed_cents else 0::numeric end,
      case when direct.link_id is not null then direct.kind else parent.kind end,
      case when direct.link_id is not null then direct.context_id else parent.context_id end,
      case when direct.link_id is not null then direct.booking_id else parent.booking_id end,
      coalesce(direct.link_id,parent.link_id),
      coalesce(direct.financial_event_id,parent.linked_event_id)
    from lineage parent join own_events child on child.related_event_id=parent.id
      left join active_links direct on direct.financial_event_id=child.id
  ), context_events as materialized (
    select e.id,e.type,e.amount_cents,e.related_event_id,e.occurred_on,e.description,e.payer_member_id,
      l.signed_cents,l.link_id,l.booking_id,l.linked_event_id<>e.id as inherited
    from lineage l join own_events e on e.id=l.id
    where l.kind=p_context_kind and l.context_id=p_context_id
      and e.type not in ('settlement','opening_balance')
      and (p_booking_id is null or l.booking_id=p_booking_id)
  ), candidates as materialized (
    select * from context_events e
    where p_before_on is null or (e.occurred_on,e.id)<(p_before_on,p_before_id)
    order by e.occurred_on desc,e.id desc limit p_page_size+1
  ), page as materialized (
    select * from candidates order by occurred_on desc,id desc limit p_page_size
  )
  select jsonb_build_object(
    'paid_cents',(select coalesce(sum(signed_cents),0)::text from context_events),
    'event_count',(select count(*)::text from context_events),
    'events',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'type',type,'amount_cents',amount_cents::text,'signed_cents',signed_cents::text,
      'related_event_id',related_event_id,'occurred_on',occurred_on,'description',description,
      'payer_member_id',payer_member_id,'context_link_id',link_id,'booking_id',booking_id,
      'inherited',inherited
    ) order by occurred_on desc,id desc) from page),'[]'::jsonb),
    'next_cursor',case when (select count(*) from candidates)>p_page_size
      then (select jsonb_build_object('occurred_on',occurred_on,'id',id)
        from page order by occurred_on,id limit 1) else null end
  ) into result;
  return result;
end;
$$;
revoke all on function public.read_household_cost_context(text,uuid,integer,date,uuid,uuid) from public,anon;
grant execute on function public.read_household_cost_context(text,uuid,integer,date,uuid,uuid) to authenticated;

-- Authorize before the claim trigger, preserving the table's existing RLS and
-- tenant-path error boundaries. A rejected parent write rolls its claim back.
create function private.guard_document_attachment_access()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_household_member(new.household_id)
    or (tg_op='INSERT' and new.created_by is distinct from auth.uid())
  then raise exception 'Document access denied' using errcode='42501'; end if;
  if new.file_path is null or new.file_path !~ ('^' || new.household_id::text || '/(receipts|completions|documents)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$')
  then raise exception 'Document file must belong to its household' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function private.guard_document_attachment_access() from public,anon,authenticated;
create trigger aa_document_attachment_access before insert or update of file_path on public.household_documents
  for each row execute function private.guard_document_attachment_access();
create trigger claim_household_document before insert or update of file_path on public.household_documents
  for each row execute function private.claim_parent_household_attachment('file_path');
