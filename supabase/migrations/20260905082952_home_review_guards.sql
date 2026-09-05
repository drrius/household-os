alter table public.activity_events validate constraint activity_events_kind_check;
alter table public.activity_events validate constraint activity_events_entity_type_check;

create function private.advance_home_record_version()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
revoke all on function private.advance_home_record_version() from public, anon, authenticated;
do $$ declare table_name text; begin
  foreach table_name in array array[
    'household_assets', 'household_contacts', 'household_commitments',
    'household_decisions', 'household_documents', 'asset_maintenance',
    'decision_options', 'asset_routines'
  ] loop
    execute format('create trigger z_home_record_version before update on public.%I for each row execute function private.advance_home_record_version()', table_name);
  end loop;
end $$;

-- Add a version gate around the connected-household archive command.
create function public.archive_household_decision_option_versioned(
  p_option_id uuid, p_archived boolean, p_version timestamptz
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_parent uuid; v_version timestamptz;
begin
  if p_version is null then raise exception 'An edit version is required' using errcode = '23514'; end if;
  select decision_id into v_parent from public.decision_options where id = p_option_id;
  if not found then raise exception 'Option not found' using errcode = '42501'; end if;
  perform 1 from public.household_decisions where id = v_parent for update;
  if not found then raise exception 'Decision not found' using errcode = '42501'; end if;
  select updated_at into v_version from public.decision_options
    where id = p_option_id and decision_id = v_parent for update;
  if not found or v_version is distinct from p_version then
    raise exception 'This option changed. Reload before trying again' using errcode = '40001';
  end if;
  perform public.archive_household_decision_option(p_option_id, p_archived);
end;
$$;
revoke all on function public.archive_household_decision_option_versioned(uuid, boolean, timestamptz) from public, anon;
grant execute on function public.archive_household_decision_option_versioned(uuid, boolean, timestamptz) to authenticated;

create function public.list_home_attention_records(
  p_kind text, p_query text default '', p_page integer default 0,
  p_today date default (now() at time zone 'Europe/Zurich')::date
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  if p_kind is null or p_kind not in ('inventory', 'commitments')
    or p_page is null or p_page < 0 or p_page > 10000 or p_today is null then
    raise exception 'Invalid attention query' using errcode = '23514';
  end if;
  with candidates as (
    select a.id, a.warranty_until as deadline, to_jsonb(a) as payload
    from public.household_assets a
    where p_kind = 'inventory' and a.archived_at is null
      and a.warranty_until between p_today and p_today + 30
      and strpos(lower(a.title), lower(left(coalesce(p_query, ''), 160))) > 0
    union all
    select c.id, c.renewal_on - c.notice_days as deadline, to_jsonb(c) as payload
    from public.household_commitments c
    where p_kind = 'commitments' and c.archived_at is null and c.status <> 'ended'
      and c.renewal_on - c.notice_days <= p_today + 30
      and strpos(lower(c.title), lower(left(coalesce(p_query, ''), 160))) > 0
  ), page_rows as (
    select * from candidates order by deadline, id limit 20 offset p_page * 20
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(payload order by deadline, id) from page_rows), '[]'::jsonb),
    'count', (select count(*) from candidates)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.list_home_attention_records(text, text, integer, date) from public, anon;
grant execute on function public.list_home_attention_records(text, text, integer, date) to authenticated;
