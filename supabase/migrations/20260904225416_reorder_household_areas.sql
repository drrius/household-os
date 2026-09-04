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
