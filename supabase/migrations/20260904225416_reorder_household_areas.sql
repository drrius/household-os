create or replace function public.reorder_household_areas(p_area_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid;
  active_ids uuid[];
begin
  select member.household_id into household
  from public.household_members as member
  where member.user_id = auth.uid();
  if household is null then
    raise exception 'caller is not a household member' using errcode = '42501';
  end if;
  perform 1 from public.households where id = household for update;
  perform 1 from public.areas where household_id = household and archived_at is null for update;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into active_ids
  from public.areas where household_id = household and archived_at is null;
  if p_area_ids is null
    or cardinality(p_area_ids) <> cardinality(active_ids)
    or array_position(p_area_ids, null) is not null
    or cardinality(p_area_ids) <> (select count(distinct id) from unnest(p_area_ids) as item(id))
    or not (p_area_ids @> active_ids and active_ids @> p_area_ids)
  then
    raise exception 'area list has changed; refresh before reordering' using errcode = '22023';
  end if;
  update public.areas as area
  set sort_order = (ordered.position * 10)::integer
  from unnest(p_area_ids) with ordinality as ordered(id, position)
  where area.id = ordered.id and area.household_id = household;
end;
$$;
revoke all on function public.reorder_household_areas(uuid[]) from public, anon;
grant execute on function public.reorder_household_areas(uuid[]) to authenticated;

-- Ordering updates use the complete-list RPC. New areas append while holding
-- the same household lock, including direct inserts and concurrent creations.
revoke update (sort_order) on public.areas from authenticated;
create function private.append_household_area()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.households where id = new.household_id for update;
  select coalesce(max(sort_order), 0) + 10 into new.sort_order
    from public.areas where household_id = new.household_id;
  return new;
end $$;
revoke all on function private.append_household_area() from public, anon, authenticated;
create trigger areas_append_order before insert on public.areas
  for each row execute function private.append_household_area();

do $$
declare table_name text;
begin
  foreach table_name in array array['areas','pets'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
