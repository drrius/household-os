-- Routine creation remains one transaction, including occurrence generation.
create table private.routine_creation_receipts (
  household_id uuid not null references public.households(id),
  idempotency_key text not null check (length(trim(idempotency_key)) between 1 and 200),
  actor_member_id uuid not null,
  request_payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (household_id, idempotency_key),
  foreign key (household_id, actor_member_id) references public.household_members(household_id, user_id)
);
alter table private.routine_creation_receipts enable row level security;
revoke all on private.routine_creation_receipts from public, anon, authenticated;

create function public.create_routine_once(p_household_id uuid, p_idempotency_key text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  previous private.routine_creation_receipts%rowtype;
  result jsonb;
begin
  if auth.uid() is null or not private.is_household_member(p_household_id) then
    raise exception 'household membership required' using errcode = '42501';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) not between 1 and 200
    or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'valid creation identity and payload required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('routine-create:' || p_household_id::text || ':' || p_idempotency_key, 0));
  select * into previous from private.routine_creation_receipts
    where household_id = p_household_id and idempotency_key = p_idempotency_key;
  if found then
    if previous.actor_member_id <> auth.uid() or previous.request_payload <> p_payload then
      raise exception 'creation request changed' using errcode = '22023';
    end if;
    return previous.result;
  end if;
  result := public.create_routine(
    p_household_id => p_household_id,
    p_title => p_payload->>'title',
    p_area_id => (p_payload->>'areaId')::uuid,
    p_assignment_policy => p_payload->>'assignmentPolicy',
    p_schedule_kind => p_payload->>'scheduleKind',
    p_schedule_rule => p_payload->'scheduleRule',
    p_assigned_member_id => (p_payload->>'assignedMemberId')::uuid,
    p_rotation_anchor_member_id => (p_payload->>'rotationAnchorMemberId')::uuid,
    p_instructions => p_payload->>'instructions',
    p_pet_id => (p_payload->>'petId')::uuid,
    p_priority => coalesce(p_payload->>'priority', 'general'),
    p_active_from => (p_payload->>'activeFrom')::date,
    p_active_until => (p_payload->>'activeUntil')::date
  );
  insert into private.routine_creation_receipts(household_id,idempotency_key,actor_member_id,request_payload,result)
    values(p_household_id,p_idempotency_key,auth.uid(),p_payload,result);
  return result;
end;
$$;
revoke all on function public.create_routine_once(uuid,text,jsonb) from public, anon;
grant execute on function public.create_routine_once(uuid,text,jsonb) to authenticated;
