create or replace function private.enforce_household_member_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  perform 1
  from public.households
  where id = new.household_id
  for update;

  if not found then
    raise exception 'household % does not exist', new.household_id
      using errcode = 'foreign_key_violation';
  end if;

  select count(*)::integer
  into current_count
  from public.household_members
  where household_id = new.household_id;

  if current_count >= 2 then
    raise exception 'household % already has the version-one member cap of 2',
      new.household_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function private.enforce_household_member_cap() is
  'Serializes household membership inserts and rejects a third version-one member.';
