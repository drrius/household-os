-- A context assignment describes an existing payment; it never posts money.
alter table public.household_financial_links
  add column revision uuid not null default extensions.gen_random_uuid();
create function private.revise_expense_context_link()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='UPDATE' and new.financial_event_id is distinct from old.financial_event_id
  then raise exception 'An association belongs to its original expense' using errcode='23514'; end if;
  new.revision := extensions.gen_random_uuid();
  return new;
end;
$$;
revoke all on function private.revise_expense_context_link() from public,anon,authenticated;
create trigger revise_expense_context_link before insert or update on public.household_financial_links
  for each row execute function private.revise_expense_context_link();

create table private.expense_context_change_receipts (
  household_id uuid not null references public.households(id) on delete cascade,
  request_id uuid not null,
  payload jsonb not null,
  event_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (household_id,request_id),
  foreign key (household_id,event_id) references public.financial_events(household_id,id)
);
alter table private.expense_context_change_receipts enable row level security;
revoke all on private.expense_context_change_receipts from public,anon,authenticated,service_role;

create function public.assign_expense_context(
  p_household_id uuid,
  p_event_id uuid,
  p_expected_revision uuid,
  p_request_id uuid,
  p_context_kind text default null,
  p_context_id uuid default null,
  p_booking_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  payload jsonb;
  previous_payload jsonb;
  existing public.household_financial_links%rowtype;
  target_archived timestamptz;
begin
  actor := private.require_money_actor(p_household_id);
  if p_request_id is null or p_event_id is null
    or (p_context_kind is null) <> (p_context_id is null)
    or (p_context_kind is not null and p_context_kind not in ('project','asset','commitment'))
    or (p_booking_id is not null and p_context_kind is distinct from 'project')
  then raise exception 'Invalid expense association' using errcode='22023'; end if;
  payload := jsonb_build_object('event',p_event_id,'expected_revision',p_expected_revision,
    'kind',p_context_kind,'context',p_context_id,'booking',p_booking_id);
  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text || ':context-request:' || p_request_id::text,0));
  select r.payload into previous_payload from private.expense_context_change_receipts r
    where r.household_id=p_household_id and r.request_id=p_request_id;
  if found then
    if previous_payload is distinct from payload
    then raise exception 'Request already used for another association' using errcode='22023'; end if;
    -- Acknowledgement only. Later intentional changes are never undone by retry.
    return jsonb_build_object('event_id',p_event_id);
  end if;
  if not exists(select 1 from public.financial_events where household_id=p_household_id
    and id=p_event_id and type in ('expense','replacement'))
  then raise exception 'Expense unavailable' using errcode='42501'; end if;

  -- Target before link: consistent with contextual posting and parent archiving.
  if p_context_id is not null then
    case p_context_kind
      when 'project' then select archived_at into target_archived from public.household_projects
        where household_id=p_household_id and id=p_context_id for update;
      when 'asset' then select archived_at into target_archived from public.household_assets
        where household_id=p_household_id and id=p_context_id for update;
      when 'commitment' then select archived_at into target_archived from public.household_commitments
        where household_id=p_household_id and id=p_context_id for update;
    end case;
    if not found then raise exception 'Expense context unavailable' using errcode='42501'; end if;
    if target_archived is not null
    then raise exception 'Restore this record before assigning expenses' using errcode='22023'; end if;
    if p_booking_id is not null then
      select archived_at into target_archived from public.trip_bookings where household_id=p_household_id
        and project_id=p_context_id and id=p_booking_id for update;
      if not found then raise exception 'Booking does not belong to this project' using errcode='22023'; end if;
      if target_archived is not null
      then raise exception 'Restore this booking before assigning expenses' using errcode='22023'; end if;
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text || ':context-event:' || p_event_id::text,0));
  select * into existing from public.household_financial_links where household_id=p_household_id
    and financial_event_id=p_event_id for update;
  if existing.revision is distinct from p_expected_revision
  then raise exception 'This expense association changed. Reopen it before saving.' using errcode='40001'; end if;

  if p_context_id is null then
    if existing.id is not null and existing.archived_at is null then
      update public.household_financial_links set archived_at=clock_timestamp() where id=existing.id;
    end if;
  elsif existing.id is null then
    insert into public.household_financial_links(household_id,created_by,financial_event_id,project_id,asset_id,commitment_id,booking_id)
      values(p_household_id,actor,p_event_id,
        case when p_context_kind='project' then p_context_id end,
        case when p_context_kind='asset' then p_context_id end,
        case when p_context_kind='commitment' then p_context_id end,p_booking_id);
  elsif existing.archived_at is not null
    or existing.project_id is distinct from (case when p_context_kind='project' then p_context_id end)
    or existing.asset_id is distinct from (case when p_context_kind='asset' then p_context_id end)
    or existing.commitment_id is distinct from (case when p_context_kind='commitment' then p_context_id end)
    or existing.booking_id is distinct from p_booking_id then
    update public.household_financial_links set archived_at=null,
      project_id=case when p_context_kind='project' then p_context_id end,
      asset_id=case when p_context_kind='asset' then p_context_id end,
      commitment_id=case when p_context_kind='commitment' then p_context_id end,
      booking_id=p_booking_id where id=existing.id;
  end if;
  insert into private.expense_context_change_receipts(household_id,request_id,payload,event_id)
    values(p_household_id,p_request_id,payload,p_event_id);
  return jsonb_build_object('event_id',p_event_id);
end;
$$;
revoke all on function public.assign_expense_context(uuid,uuid,uuid,uuid,text,uuid,uuid) from public,anon;
grant execute on function public.assign_expense_context(uuid,uuid,uuid,uuid,text,uuid,uuid) to authenticated;
