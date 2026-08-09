create table public.areas (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  sort_order integer not null check (sort_order >= 0),
  archived_at timestamptz,
  unique (household_id, id),
  unique (household_id, name)
);

create table public.pets (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  photo_path text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, id)
);

create or replace function private.is_valid_routine_schedule(
  p_schedule_kind text,
  p_schedule_rule jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  rule_kind text;
  item jsonb;
  value_integer integer;
  seen_weekdays integer[] := '{}';
  value_date date;
begin
  if p_schedule_rule is null or jsonb_typeof(p_schedule_rule) <> 'object' then
    return false;
  end if;

  rule_kind := p_schedule_rule ->> 'kind';
  case rule_kind
    when 'one_off' then
      if p_schedule_kind <> 'one_off'
        or p_schedule_rule - array['kind', 'date'] <> '{}'::jsonb
        or jsonb_typeof(p_schedule_rule -> 'date') <> 'string'
      then
        return false;
      end if;
      value_date := (p_schedule_rule ->> 'date')::date;
      return to_char(value_date, 'YYYY-MM-DD') = p_schedule_rule ->> 'date';
    when 'daily' then
      return p_schedule_kind = 'calendar'
        and p_schedule_rule = '{"kind":"daily"}'::jsonb;
    when 'weekdays' then
      if p_schedule_kind <> 'calendar'
        or p_schedule_rule - array['kind', 'days'] <> '{}'::jsonb
        or jsonb_typeof(p_schedule_rule -> 'days') <> 'array'
        or jsonb_array_length(p_schedule_rule -> 'days') = 0
      then
        return false;
      end if;

      for item in
        select element
        from jsonb_array_elements(p_schedule_rule -> 'days') as days(element)
      loop
        if jsonb_typeof(item) <> 'number'
          or (item #>> '{}') !~ '^[0-9]+$'
        then
          return false;
        end if;
        value_integer := (item #>> '{}')::integer;
        if value_integer not between 1 and 7
          or value_integer = any(seen_weekdays)
        then
          return false;
        end if;
        seen_weekdays := array_append(seen_weekdays, value_integer);
      end loop;
      return true;
    when 'weekly' then
      if p_schedule_kind <> 'calendar'
        or p_schedule_rule - array['kind', 'weekday'] <> '{}'::jsonb
        or jsonb_typeof(p_schedule_rule -> 'weekday') <> 'number'
        or (p_schedule_rule ->> 'weekday') !~ '^[0-9]+$'
      then
        return false;
      end if;
      return (p_schedule_rule ->> 'weekday')::integer between 1 and 7;
    when 'monthly' then
      if p_schedule_kind <> 'calendar'
        or p_schedule_rule - array['kind', 'dayOfMonth'] <> '{}'::jsonb
        or jsonb_typeof(p_schedule_rule -> 'dayOfMonth') <> 'number'
        or (p_schedule_rule ->> 'dayOfMonth') !~ '^[0-9]+$'
      then
        return false;
      end if;
      return (p_schedule_rule ->> 'dayOfMonth')::integer between 1 and 31;
    when 'after_completion' then
      if p_schedule_kind <> 'after_completion'
        or p_schedule_rule - array['kind', 'every', 'unit'] <> '{}'::jsonb
        or jsonb_typeof(p_schedule_rule -> 'every') <> 'number'
        or (p_schedule_rule ->> 'every') !~ '^[0-9]+$'
        or p_schedule_rule ->> 'unit' not in ('days', 'weeks')
      then
        return false;
      end if;
      return (p_schedule_rule ->> 'every')::integer >= 1;
    else
      return false;
  end case;
exception
  when others then
    return false;
end;
$$;

revoke all on function private.is_valid_routine_schedule(text, jsonb)
from public, anon, authenticated;

create table public.routines (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  instructions text check (instructions is null or length(instructions) <= 4000),
  area_id uuid not null,
  pet_id uuid,
  assignment_policy text not null
    check (assignment_policy in ('assigned', 'alternating', 'shared')),
  assigned_member_id uuid,
  rotation_anchor_member_id uuid,
  schedule_kind text not null
    check (schedule_kind in ('one_off', 'calendar', 'after_completion')),
  schedule_rule jsonb not null,
  priority text not null default 'general'
    check (priority in ('pet_care', 'meal_deadline', 'cleaning', 'general')),
  active_from date,
  active_until date,
  paused_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, area_id)
    references public.areas(household_id, id),
  foreign key (household_id, pet_id)
    references public.pets(household_id, id),
  foreign key (household_id, assigned_member_id)
    references public.household_members(household_id, user_id),
  foreign key (household_id, rotation_anchor_member_id)
    references public.household_members(household_id, user_id),
  check (
    (
      assignment_policy = 'assigned'
      and assigned_member_id is not null
      and rotation_anchor_member_id is null
    )
    or (
      assignment_policy = 'alternating'
      and assigned_member_id is null
      and rotation_anchor_member_id is not null
    )
    or (
      assignment_policy = 'shared'
      and assigned_member_id is null
      and rotation_anchor_member_id is null
    )
  ),
  check (private.is_valid_routine_schedule(schedule_kind, schedule_rule)),
  check (active_until is null or active_from is null or active_until >= active_from)
);

create table public.routine_occurrences (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null,
  routine_id uuid not null,
  due_date date not null,
  original_due_date date not null,
  planned_assignee_id uuid,
  status text not null check (status in ('open', 'completed', 'skipped')),
  role text,
  rescheduled_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, routine_id)
    references public.routines(household_id, id) on delete cascade,
  foreign key (household_id, planned_assignee_id)
    references public.household_members(household_id, user_id),
  check (
    (status = 'open' and role in ('current', 'preview') and closed_at is null)
    or
    (status in ('completed', 'skipped') and role is null and closed_at is not null)
  )
);

create unique index routine_occurrences_one_open_current_idx
  on public.routine_occurrences (routine_id)
  where status = 'open' and role = 'current';

create unique index routine_occurrences_one_open_preview_idx
  on public.routine_occurrences (routine_id)
  where status = 'open' and role = 'preview';

create index routine_occurrences_household_due_idx
  on public.routine_occurrences (household_id, due_date)
  where status = 'open';

create table public.routine_completions (
  occurrence_id uuid primary key,
  household_id uuid not null,
  completed_by_member_id uuid not null,
  completed_at timestamptz not null default now(),
  completed_on date not null,
  note text check (note is null or length(note) <= 2000),
  photo_path text,
  foreign key (household_id, occurrence_id)
    references public.routine_occurrences(household_id, id),
  foreign key (household_id, completed_by_member_id)
    references public.household_members(household_id, user_id)
);

create table public.routine_command_receipts (
  household_id uuid not null references public.households(id) on delete cascade,
  idempotency_key text not null check (length(trim(idempotency_key)) between 1 and 200),
  command_kind text not null
    check (command_kind in ('complete', 'skip', 'reschedule')),
  occurrence_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (household_id, idempotency_key),
  foreign key (household_id, occurrence_id)
    references public.routine_occurrences(household_id, id)
);

create table public.activity_events (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  actor_member_id uuid not null,
  kind text not null check (
    kind in (
      'routine_created',
      'occurrence_completed',
      'occurrence_skipped',
      'occurrence_rescheduled',
      'routine_paused',
      'routine_unpaused',
      'routine_archived'
    )
  ),
  entity_type text not null
    check (entity_type in ('routine', 'routine_occurrence')),
  entity_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (household_id, actor_member_id)
    references public.household_members(household_id, user_id)
);

create index activity_events_household_created_idx
  on public.activity_events (household_id, created_at desc);

create table public.routine_reminder_preferences (
  routine_id uuid not null,
  member_id uuid not null,
  household_id uuid not null,
  enabled boolean not null default false,
  due_day_local_time time not null default '09:00',
  primary key (routine_id, member_id),
  unique (household_id, routine_id, member_id),
  foreign key (household_id, routine_id)
    references public.routines(household_id, id) on delete cascade,
  foreign key (household_id, member_id)
    references public.household_members(household_id, user_id)
);

create table public.reminder_candidates (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null,
  occurrence_id uuid not null,
  remind_on date not null,
  remind_local_time time not null,
  status text not null default 'pending'
    check (status in ('pending', 'cancelled', 'delivered')),
  created_at timestamptz not null default now(),
  unique (household_id, member_id, occurrence_id),
  foreign key (household_id, member_id)
    references public.household_members(household_id, user_id),
  foreign key (household_id, occurrence_id)
    references public.routine_occurrences(household_id, id) on delete cascade
);

create index reminder_candidates_pending_idx
  on public.reminder_candidates (household_id, member_id, remind_on)
  where status = 'pending';

create or replace function private.first_routine_due_date(
  p_schedule_rule jsonb,
  p_from_inclusive date
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  rule_kind text := p_schedule_rule ->> 'kind';
  candidate date;
  requested integer;
  month_start date;
  last_day integer;
  step integer;
begin
  case rule_kind
    when 'one_off' then
      return (p_schedule_rule ->> 'date')::date;
    when 'daily' then
      return p_from_inclusive;
    when 'weekdays' then
      candidate := p_from_inclusive;
      for step in 0..7 loop
        if extract(isodow from candidate)::integer in (
          select value::integer
          from jsonb_array_elements_text(p_schedule_rule -> 'days') as day(value)
        ) then
          return candidate;
        end if;
        candidate := candidate + 1;
      end loop;
      raise exception 'failed to find a selected weekday';
    when 'weekly' then
      requested := (p_schedule_rule ->> 'weekday')::integer;
      return p_from_inclusive
        + ((requested - extract(isodow from p_from_inclusive)::integer + 7) % 7);
    when 'monthly' then
      requested := (p_schedule_rule ->> 'dayOfMonth')::integer;
      month_start := date_trunc('month', p_from_inclusive)::date;
      last_day := extract(day from month_start + interval '1 month - 1 day')::integer;
      candidate := make_date(
        extract(year from month_start)::integer,
        extract(month from month_start)::integer,
        least(requested, last_day)
      );
      if candidate >= p_from_inclusive then
        return candidate;
      end if;
      month_start := (month_start + interval '1 month')::date;
      last_day := extract(day from month_start + interval '1 month - 1 day')::integer;
      return make_date(
        extract(year from month_start)::integer,
        extract(month from month_start)::integer,
        least(requested, last_day)
      );
    when 'after_completion' then
      requested := (p_schedule_rule ->> 'every')::integer;
      if p_schedule_rule ->> 'unit' = 'days' then
        return p_from_inclusive + requested;
      end if;
      if p_schedule_rule ->> 'unit' = 'weeks' then
        return p_from_inclusive + (requested * 7);
      end if;
      raise exception 'unknown after_completion unit %', p_schedule_rule ->> 'unit';
    else
      raise exception 'unknown schedule rule kind %', rule_kind;
  end case;
end;
$$;

create or replace function private.next_routine_due_date(
  p_schedule_rule jsonb,
  p_closed_due_date date,
  p_completed_on date default null
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  rule_kind text := p_schedule_rule ->> 'kind';
  every_n integer;
  anchor_date date;
begin
  case rule_kind
    when 'one_off' then
      return null;
    when 'daily' then
      return p_closed_due_date + 1;
    when 'weekdays', 'weekly', 'monthly' then
      return private.first_routine_due_date(p_schedule_rule, p_closed_due_date + 1);
    when 'after_completion' then
      every_n := (p_schedule_rule ->> 'every')::integer;
      anchor_date := coalesce(p_completed_on, p_closed_due_date);
      if p_schedule_rule ->> 'unit' = 'days' then
        return anchor_date + every_n;
      end if;
      if p_schedule_rule ->> 'unit' = 'weeks' then
        return anchor_date + (every_n * 7);
      end if;
      raise exception 'unknown after_completion unit %', p_schedule_rule ->> 'unit';
    else
      raise exception 'unknown schedule rule kind %', rule_kind;
  end case;
end;
$$;

create or replace function private.next_routine_assignee(
  p_household_id uuid,
  p_assignment_policy text,
  p_assigned_member_id uuid,
  p_rotation_anchor_member_id uuid,
  p_previous_planned_assignee_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  next_member_id uuid;
begin
  case p_assignment_policy
    when 'assigned' then
      return p_assigned_member_id;
    when 'shared' then
      return null;
    when 'alternating' then
      if p_previous_planned_assignee_id is null then
        return p_rotation_anchor_member_id;
      end if;
      select member.user_id
      into next_member_id
      from public.household_members as member
      where member.household_id = p_household_id
        and member.user_id <> p_previous_planned_assignee_id
      order by member.joined_at, member.user_id
      limit 1;
      if next_member_id is null then
        raise exception 'alternating assignment requires two household members';
      end if;
      return next_member_id;
    else
      raise exception 'unknown assignment policy %', p_assignment_policy;
  end case;
end;
$$;

create or replace function private.create_reminder_candidates_for_occurrence(
  p_occurrence_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reminder_candidates (
    household_id,
    member_id,
    occurrence_id,
    remind_on,
    remind_local_time,
    status
  )
  select
    occurrence.household_id,
    preference.member_id,
    occurrence.id,
    occurrence.due_date,
    preference.due_day_local_time,
    'pending'
  from public.routine_occurrences as occurrence
  join public.routine_reminder_preferences as preference
    on preference.household_id = occurrence.household_id
    and preference.routine_id = occurrence.routine_id
    and preference.enabled
  where occurrence.id = p_occurrence_id
    and occurrence.status = 'open'
  on conflict (household_id, member_id, occurrence_id)
  do update
  set remind_on = excluded.remind_on,
      remind_local_time = excluded.remind_local_time,
      status = 'pending';
end;
$$;

create or replace function private.insert_open_routine_occurrence(
  p_routine public.routines,
  p_role text,
  p_due_date date,
  p_previous_planned_assignee_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  occurrence_id uuid;
  planned_assignee_id uuid;
begin
  if p_role not in ('current', 'preview') then
    raise exception 'unknown occurrence role %', p_role;
  end if;

  planned_assignee_id := private.next_routine_assignee(
    p_routine.household_id,
    p_routine.assignment_policy,
    p_routine.assigned_member_id,
    p_routine.rotation_anchor_member_id,
    p_previous_planned_assignee_id
  );

  insert into public.routine_occurrences (
    household_id,
    routine_id,
    due_date,
    original_due_date,
    planned_assignee_id,
    status,
    role
  )
  values (
    p_routine.household_id,
    p_routine.id,
    p_due_date,
    p_due_date,
    planned_assignee_id,
    'open',
    p_role
  )
  returning id into occurrence_id;

  perform private.create_reminder_candidates_for_occurrence(occurrence_id);
  return occurrence_id;
end;
$$;

create or replace function private.ensure_routine_window(
  p_routine_id uuid,
  p_first_due_date date default null,
  p_previous_planned_assignee_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  routine public.routines%rowtype;
  current_occurrence public.routine_occurrences%rowtype;
  latest_occurrence public.routine_occurrences%rowtype;
  first_due_date date := p_first_due_date;
  second_due_date date;
  previous_assignee_id uuid := p_previous_planned_assignee_id;
  current_occurrence_id uuid;
  latest_completed_on date;
begin
  select stored_routine.*
  into routine
  from public.routines as stored_routine
  where stored_routine.id = p_routine_id
  for update;

  if not found or routine.archived_at is not null or routine.paused_at is not null then
    return;
  end if;

  select occurrence.*
  into current_occurrence
  from public.routine_occurrences as occurrence
  where occurrence.routine_id = routine.id
    and occurrence.status = 'open'
    and occurrence.role = 'current'
  for update;

  if found then
    perform 1
    from public.routine_occurrences as occurrence
    where occurrence.routine_id = routine.id
      and occurrence.status = 'open'
      and occurrence.role = 'preview'
    for update;
    if found then
      return;
    end if;

    second_due_date := private.next_routine_due_date(
      routine.schedule_rule,
      current_occurrence.due_date,
      null
    );
    if second_due_date is not null
      and (routine.active_until is null or second_due_date <= routine.active_until)
    then
      perform private.insert_open_routine_occurrence(
        routine,
        'preview',
        second_due_date,
        current_occurrence.planned_assignee_id
      );
    end if;
    return;
  end if;

  if first_due_date is null then
    select occurrence.*, completion.completed_on
    into latest_occurrence, latest_completed_on
    from public.routine_occurrences as occurrence
    left join public.routine_completions as completion
      on completion.occurrence_id = occurrence.id
    where occurrence.routine_id = routine.id
      and occurrence.status in ('completed', 'skipped')
    order by occurrence.closed_at desc, occurrence.created_at desc
    limit 1;

    if found then
      previous_assignee_id := latest_occurrence.planned_assignee_id;
      first_due_date := private.next_routine_due_date(
        routine.schedule_rule,
        latest_occurrence.due_date,
        latest_completed_on
      );
    else
      first_due_date := private.first_routine_due_date(
        routine.schedule_rule,
        greatest(current_date, coalesce(routine.active_from, current_date))
      );
    end if;
  end if;

  if first_due_date is null
    or (routine.active_until is not null and first_due_date > routine.active_until)
  then
    return;
  end if;

  current_occurrence_id := private.insert_open_routine_occurrence(
    routine,
    'current',
    first_due_date,
    previous_assignee_id
  );

  select occurrence.*
  into current_occurrence
  from public.routine_occurrences as occurrence
  where occurrence.id = current_occurrence_id;

  second_due_date := private.next_routine_due_date(
    routine.schedule_rule,
    first_due_date,
    null
  );
  if second_due_date is not null
    and (routine.active_until is null or second_due_date <= routine.active_until)
  then
    perform private.insert_open_routine_occurrence(
      routine,
      'preview',
      second_due_date,
      current_occurrence.planned_assignee_id
    );
  end if;
end;
$$;

create or replace function private.seed_default_areas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.areas (household_id, name, sort_order)
  values
    (new.id, 'Cleaning', 1),
    (new.id, 'Kitchen', 2),
    (new.id, 'Laundry', 3),
    (new.id, 'Dog', 4),
    (new.id, 'Meals', 5),
    (new.id, 'General', 6)
  on conflict (household_id, name) do nothing;
  return new;
end;
$$;

create trigger households_seed_default_areas
after insert on public.households
for each row
execute function private.seed_default_areas();

insert into public.areas (household_id, name, sort_order)
select household.id, defaults.name, defaults.sort_order
from public.households as household
cross join (
  values
    ('Cleaning'::text, 1),
    ('Kitchen'::text, 2),
    ('Laundry'::text, 3),
    ('Dog'::text, 4),
    ('Meals'::text, 5),
    ('General'::text, 6)
) as defaults(name, sort_order)
on conflict (household_id, name) do nothing;

create or replace function private.set_routine_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger routines_set_updated_at
before update on public.routines
for each row
execute function private.set_routine_updated_at();

create or replace function private.sync_routine_reminder_preference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  occurrence_id uuid;
begin
  if new.enabled then
    for occurrence_id in
      select occurrence.id
      from public.routine_occurrences as occurrence
      where occurrence.routine_id = new.routine_id
        and occurrence.status = 'open'
    loop
      perform private.create_reminder_candidates_for_occurrence(occurrence_id);
    end loop;
  else
    update public.reminder_candidates as candidate
    set status = 'cancelled'
    from public.routine_occurrences as occurrence
    where occurrence.id = candidate.occurrence_id
      and occurrence.routine_id = new.routine_id
      and candidate.member_id = new.member_id
      and candidate.status = 'pending';
  end if;
  return new;
end;
$$;

create trigger routine_reminder_preferences_sync_candidates
after insert or update of enabled, due_day_local_time
on public.routine_reminder_preferences
for each row
execute function private.sync_routine_reminder_preference();

create or replace function public.create_routine(
  p_household_id uuid,
  p_title text,
  p_area_id uuid,
  p_assignment_policy text,
  p_schedule_kind text,
  p_schedule_rule jsonb,
  p_assigned_member_id uuid default null,
  p_rotation_anchor_member_id uuid default null,
  p_instructions text default null,
  p_pet_id uuid default null,
  p_priority text default 'general',
  p_active_from date default null,
  p_active_until date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  routine_id uuid;
  first_due_date date;
  current_occurrence_id uuid;
  preview_occurrence_id uuid;
begin
  if actor_member_id is null
    or not private.is_household_member(p_household_id)
  then
    raise exception 'caller is not a member of household %', p_household_id
      using errcode = '42501';
  end if;

  if (select count(*) from public.household_members where household_id = p_household_id) <> 2 then
    raise exception 'routine assignment requires exactly two household members'
      using errcode = '23514';
  end if;

  if p_title is null or length(trim(p_title)) not between 1 and 120 then
    raise exception 'routine title must contain 1 to 120 characters'
      using errcode = '22023';
  end if;

  if not private.is_valid_routine_schedule(p_schedule_kind, p_schedule_rule) then
    raise exception 'invalid schedule rule for schedule kind %', p_schedule_kind
      using errcode = '22023';
  end if;

  case p_assignment_policy
    when 'assigned' then
      if p_assigned_member_id is null or p_rotation_anchor_member_id is not null then
        raise exception 'assigned routines require only assigned_member_id'
          using errcode = '22023';
      end if;
    when 'alternating' then
      if p_assigned_member_id is not null or p_rotation_anchor_member_id is null then
        raise exception 'alternating routines require only rotation_anchor_member_id'
          using errcode = '22023';
      end if;
    when 'shared' then
      if p_assigned_member_id is not null or p_rotation_anchor_member_id is not null then
        raise exception 'shared routines cannot name an assignee'
          using errcode = '22023';
      end if;
    else
      raise exception 'unknown assignment policy %', p_assignment_policy
        using errcode = '22023';
  end case;

  if p_priority not in ('pet_care', 'meal_deadline', 'cleaning', 'general') then
    raise exception 'unknown routine priority %', p_priority
      using errcode = '22023';
  end if;

  if p_active_from is not null
    and p_active_until is not null
    and p_active_until < p_active_from
  then
    raise exception 'active_until must not precede active_from'
      using errcode = '22023';
  end if;

  first_due_date := private.first_routine_due_date(
    p_schedule_rule,
    greatest(current_date, coalesce(p_active_from, current_date))
  );
  if p_active_from is not null and first_due_date < p_active_from then
    raise exception 'first due date precedes active_from'
      using errcode = '22023';
  end if;
  if p_active_until is not null and first_due_date > p_active_until then
    raise exception 'first due date exceeds active_until'
      using errcode = '22023';
  end if;

  insert into public.routines (
    household_id,
    title,
    instructions,
    area_id,
    pet_id,
    assignment_policy,
    assigned_member_id,
    rotation_anchor_member_id,
    schedule_kind,
    schedule_rule,
    priority,
    active_from,
    active_until
  )
  values (
    p_household_id,
    trim(p_title),
    p_instructions,
    p_area_id,
    p_pet_id,
    p_assignment_policy,
    p_assigned_member_id,
    p_rotation_anchor_member_id,
    p_schedule_kind,
    p_schedule_rule,
    p_priority,
    p_active_from,
    p_active_until
  )
  returning id into routine_id;

  perform private.ensure_routine_window(routine_id, first_due_date, null);

  insert into public.activity_events (
    household_id,
    actor_member_id,
    kind,
    entity_type,
    entity_id,
    payload
  )
  values (
    p_household_id,
    actor_member_id,
    'routine_created',
    'routine',
    routine_id,
    jsonb_build_object('title', trim(p_title))
  );

  select occurrence.id
  into current_occurrence_id
  from public.routine_occurrences as occurrence
  where occurrence.routine_id = routine_id
    and occurrence.status = 'open'
    and occurrence.role = 'current';

  select occurrence.id
  into preview_occurrence_id
  from public.routine_occurrences as occurrence
  where occurrence.routine_id = routine_id
    and occurrence.status = 'open'
    and occurrence.role = 'preview';

  return jsonb_strip_nulls(
    jsonb_build_object(
      'routine_id', routine_id,
      'current_occurrence_id', current_occurrence_id,
      'preview_occurrence_id', preview_occurrence_id
    )
  );
end;
$$;

create or replace function private.apply_routine_closure(
  p_occurrence_id uuid,
  p_idempotency_key text,
  p_command_kind text,
  p_completed_on date default null,
  p_new_due_date date default null,
  p_note text default null,
  p_photo_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  target_household_id uuid;
  occurrence public.routine_occurrences%rowtype;
  preview public.routine_occurrences%rowtype;
  routine public.routines%rowtype;
  prior_result jsonb;
  result jsonb;
  routine_active boolean;
  had_preview boolean := false;
  first_due_date date;
  second_due_date date;
  current_occurrence_id uuid;
  preview_occurrence_id uuid;
  new_current public.routine_occurrences%rowtype;
begin
  if p_idempotency_key is null
    or length(trim(p_idempotency_key)) not between 1 and 200
  then
    raise exception 'idempotency key must contain 1 to 200 characters'
      using errcode = '22023';
  end if;

  if p_command_kind not in ('complete', 'skip', 'reschedule') then
    raise exception 'unknown routine command kind %', p_command_kind
      using errcode = '22023';
  end if;

  select stored_occurrence.household_id
  into target_household_id
  from public.routine_occurrences as stored_occurrence
  where stored_occurrence.id = p_occurrence_id;

  if not found then
    raise exception 'routine occurrence % does not exist', p_occurrence_id
      using errcode = 'P0002';
  end if;

  if actor_member_id is null
    or not private.is_household_member(target_household_id)
  then
    raise exception 'caller is not a member of household %', target_household_id
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_household_id::text || ':' || p_idempotency_key, 0)
  );

  select receipt.result
  into prior_result
  from public.routine_command_receipts as receipt
  where receipt.household_id = target_household_id
    and receipt.idempotency_key = p_idempotency_key;
  if found then
    return prior_result;
  end if;

  select stored_occurrence.*
  into occurrence
  from public.routine_occurrences as stored_occurrence
  where stored_occurrence.id = p_occurrence_id
  for update;

  select stored_routine.*
  into routine
  from public.routines as stored_routine
  where stored_routine.id = occurrence.routine_id
  for update;

  if occurrence.status <> 'open' then
    raise exception 'routine occurrence % is not open', occurrence.id
      using errcode = '55000';
  end if;
  if occurrence.role <> 'current' then
    raise exception 'only the current occurrence can be changed'
      using errcode = '55000';
  end if;

  select stored_preview.*
  into preview
  from public.routine_occurrences as stored_preview
  where stored_preview.routine_id = routine.id
    and stored_preview.status = 'open'
    and stored_preview.role = 'preview'
  for update;
  had_preview := found;

  routine_active := routine.archived_at is null
    and routine.paused_at is null
    and (routine.active_from is null or current_date >= routine.active_from)
    and (routine.active_until is null or current_date <= routine.active_until);

  if p_command_kind = 'reschedule' then
    if p_new_due_date is null or p_new_due_date = occurrence.due_date then
      raise exception 'reschedule date must differ from the current due date'
        using errcode = '22023';
    end if;

    update public.routine_occurrences
    set due_date = p_new_due_date,
        rescheduled_at = now()
    where id = occurrence.id;

    perform private.create_reminder_candidates_for_occurrence(occurrence.id);

    if had_preview and routine_active then
      delete from public.routine_occurrences where id = preview.id;
      second_due_date := private.next_routine_due_date(
        routine.schedule_rule,
        p_new_due_date,
        null
      );
      if second_due_date is not null
        and (routine.active_until is null or second_due_date <= routine.active_until)
      then
        preview_occurrence_id := private.insert_open_routine_occurrence(
          routine,
          'preview',
          second_due_date,
          occurrence.planned_assignee_id
        );
      end if;
    end if;

    insert into public.activity_events (
      household_id,
      actor_member_id,
      kind,
      entity_type,
      entity_id,
      payload
    )
    values (
      routine.household_id,
      actor_member_id,
      'occurrence_rescheduled',
      'routine_occurrence',
      occurrence.id,
      jsonb_build_object(
        'routine_id', routine.id,
        'from_due_date', occurrence.due_date,
        'to_due_date', p_new_due_date
      )
    );
  else
    if p_command_kind = 'complete' and p_completed_on is null then
      raise exception 'completed_on is required for completion'
        using errcode = '22023';
    end if;

    update public.routine_occurrences
    set status = case
          when p_command_kind = 'complete' then 'completed'
          else 'skipped'
        end,
        role = null,
        closed_at = now()
    where id = occurrence.id;

    if p_command_kind = 'complete' then
      insert into public.routine_completions (
        occurrence_id,
        household_id,
        completed_by_member_id,
        completed_on,
        note,
        photo_path
      )
      values (
        occurrence.id,
        routine.household_id,
        actor_member_id,
        p_completed_on,
        p_note,
        p_photo_path
      );
    end if;

    update public.reminder_candidates
    set status = 'cancelled'
    where occurrence_id = occurrence.id
      and status = 'pending';

    if routine_active then
      first_due_date := private.next_routine_due_date(
        routine.schedule_rule,
        occurrence.due_date,
        case when p_command_kind = 'complete' then p_completed_on else null end
      );
    end if;

    if not routine_active
      or first_due_date is null
      or (routine.active_until is not null and first_due_date > routine.active_until)
    then
      if had_preview then
        delete from public.routine_occurrences where id = preview.id;
      end if;
    elsif had_preview
      and routine.schedule_kind <> 'after_completion'
      and preview.due_date = first_due_date
    then
      update public.routine_occurrences
      set role = 'current'
      where id = preview.id;
      current_occurrence_id := preview.id;
      second_due_date := private.next_routine_due_date(
        routine.schedule_rule,
        preview.due_date,
        null
      );
      if second_due_date is not null
        and (routine.active_until is null or second_due_date <= routine.active_until)
      then
        preview_occurrence_id := private.insert_open_routine_occurrence(
          routine,
          'preview',
          second_due_date,
          preview.planned_assignee_id
        );
      end if;
    else
      if had_preview then
        delete from public.routine_occurrences where id = preview.id;
      end if;
      current_occurrence_id := private.insert_open_routine_occurrence(
        routine,
        'current',
        first_due_date,
        occurrence.planned_assignee_id
      );
      select stored_occurrence.*
      into new_current
      from public.routine_occurrences as stored_occurrence
      where stored_occurrence.id = current_occurrence_id;
      second_due_date := private.next_routine_due_date(
        routine.schedule_rule,
        first_due_date,
        null
      );
      if second_due_date is not null
        and (routine.active_until is null or second_due_date <= routine.active_until)
      then
        preview_occurrence_id := private.insert_open_routine_occurrence(
          routine,
          'preview',
          second_due_date,
          new_current.planned_assignee_id
        );
      end if;
    end if;

    insert into public.activity_events (
      household_id,
      actor_member_id,
      kind,
      entity_type,
      entity_id,
      payload
    )
    values (
      routine.household_id,
      actor_member_id,
      case
        when p_command_kind = 'complete' then 'occurrence_completed'
        else 'occurrence_skipped'
      end,
      'routine_occurrence',
      occurrence.id,
      jsonb_strip_nulls(
        jsonb_build_object(
          'routine_id', routine.id,
          'due_date', occurrence.due_date,
          'completed_on', p_completed_on
        )
      )
    );
  end if;

  select stored_occurrence.id
  into current_occurrence_id
  from public.routine_occurrences as stored_occurrence
  where stored_occurrence.routine_id = routine.id
    and stored_occurrence.status = 'open'
    and stored_occurrence.role = 'current';

  select stored_occurrence.id
  into preview_occurrence_id
  from public.routine_occurrences as stored_occurrence
  where stored_occurrence.routine_id = routine.id
    and stored_occurrence.status = 'open'
    and stored_occurrence.role = 'preview';

  result := jsonb_strip_nulls(
    jsonb_build_object(
      'occurrence_id', occurrence.id,
      'routine_id', routine.id,
      'status', case
        when p_command_kind = 'complete' then 'completed'
        when p_command_kind = 'skip' then 'skipped'
        when p_command_kind = 'reschedule' then 'open'
      end,
      'current_occurrence_id', current_occurrence_id,
      'preview_occurrence_id', preview_occurrence_id
    )
  );

  insert into public.routine_command_receipts (
    household_id,
    idempotency_key,
    command_kind,
    occurrence_id,
    result
  )
  values (
    routine.household_id,
    p_idempotency_key,
    p_command_kind,
    occurrence.id,
    result
  );
  return result;
end;
$$;

create or replace function public.complete_occurrence(
  p_occurrence_id uuid,
  p_idempotency_key text,
  p_completed_on date,
  p_note text default null,
  p_photo_path text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.apply_routine_closure(
    p_occurrence_id,
    p_idempotency_key,
    'complete',
    p_completed_on,
    null,
    p_note,
    p_photo_path
  );
$$;

create or replace function public.skip_occurrence(
  p_occurrence_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.apply_routine_closure(
    p_occurrence_id,
    p_idempotency_key,
    'skip',
    null,
    null,
    null,
    null
  );
$$;

create or replace function public.reschedule_occurrence(
  p_occurrence_id uuid,
  p_new_due_date date,
  p_idempotency_key text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.apply_routine_closure(
    p_occurrence_id,
    p_idempotency_key,
    'reschedule',
    null,
    p_new_due_date,
    null,
    null
  );
$$;

create or replace function public.pause_routine(p_routine_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  routine public.routines%rowtype;
begin
  select stored_routine.*
  into routine
  from public.routines as stored_routine
  where stored_routine.id = p_routine_id
  for update;
  if not found then
    raise exception 'routine % does not exist', p_routine_id using errcode = 'P0002';
  end if;
  if actor_member_id is null or not private.is_household_member(routine.household_id) then
    raise exception 'caller is not a household member' using errcode = '42501';
  end if;
  if routine.archived_at is not null then
    raise exception 'archived routines cannot be paused' using errcode = '55000';
  end if;

  if routine.paused_at is null then
    update public.routines set paused_at = now() where id = routine.id;
    update public.reminder_candidates as candidate
    set status = 'cancelled'
    from public.routine_occurrences as occurrence
    where occurrence.id = candidate.occurrence_id
      and occurrence.routine_id = routine.id
      and occurrence.status = 'open'
      and candidate.status = 'pending';
    insert into public.activity_events (
      household_id, actor_member_id, kind, entity_type, entity_id
    )
    values (
      routine.household_id, actor_member_id, 'routine_paused', 'routine', routine.id
    );
  end if;
  return jsonb_build_object('routine_id', routine.id, 'paused', true);
end;
$$;

create or replace function public.unpause_routine(p_routine_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  routine public.routines%rowtype;
  occurrence_id uuid;
begin
  select stored_routine.*
  into routine
  from public.routines as stored_routine
  where stored_routine.id = p_routine_id
  for update;
  if not found then
    raise exception 'routine % does not exist', p_routine_id using errcode = 'P0002';
  end if;
  if actor_member_id is null or not private.is_household_member(routine.household_id) then
    raise exception 'caller is not a household member' using errcode = '42501';
  end if;
  if routine.archived_at is not null then
    raise exception 'archived routines cannot be unpaused' using errcode = '55000';
  end if;

  if routine.paused_at is not null then
    update public.routines set paused_at = null where id = routine.id;
    perform private.ensure_routine_window(routine.id, null, null);
    for occurrence_id in
      select occurrence.id
      from public.routine_occurrences as occurrence
      where occurrence.routine_id = routine.id
        and occurrence.status = 'open'
    loop
      perform private.create_reminder_candidates_for_occurrence(occurrence_id);
    end loop;
    insert into public.activity_events (
      household_id, actor_member_id, kind, entity_type, entity_id
    )
    values (
      routine.household_id, actor_member_id, 'routine_unpaused', 'routine', routine.id
    );
  end if;
  return jsonb_build_object('routine_id', routine.id, 'paused', false);
end;
$$;

create or replace function public.archive_routine(p_routine_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  routine public.routines%rowtype;
begin
  select stored_routine.*
  into routine
  from public.routines as stored_routine
  where stored_routine.id = p_routine_id
  for update;
  if not found then
    raise exception 'routine % does not exist', p_routine_id using errcode = 'P0002';
  end if;
  if actor_member_id is null or not private.is_household_member(routine.household_id) then
    raise exception 'caller is not a household member' using errcode = '42501';
  end if;

  if routine.archived_at is null then
    update public.routines set archived_at = now() where id = routine.id;
    update public.reminder_candidates as candidate
    set status = 'cancelled'
    from public.routine_occurrences as occurrence
    where occurrence.id = candidate.occurrence_id
      and occurrence.routine_id = routine.id
      and occurrence.status = 'open'
      and candidate.status = 'pending';
    delete from public.routine_occurrences
    where routine_id = routine.id
      and status = 'open'
      and role = 'preview';
    insert into public.activity_events (
      household_id, actor_member_id, kind, entity_type, entity_id
    )
    values (
      routine.household_id, actor_member_id, 'routine_archived', 'routine', routine.id
    );
  end if;
  return jsonb_build_object('routine_id', routine.id, 'archived', true);
end;
$$;

alter table public.areas enable row level security;
alter table public.pets enable row level security;
alter table public.routines enable row level security;
alter table public.routine_occurrences enable row level security;
alter table public.routine_completions enable row level security;
alter table public.routine_command_receipts enable row level security;
alter table public.activity_events enable row level security;
alter table public.routine_reminder_preferences enable row level security;
alter table public.reminder_candidates enable row level security;

create policy "members can read areas"
on public.areas for select to authenticated
using ((select private.is_household_member(household_id)));
create policy "members can create areas"
on public.areas for insert to authenticated
with check ((select private.is_household_member(household_id)));
create policy "members can update areas"
on public.areas for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));

create policy "members can read pets"
on public.pets for select to authenticated
using ((select private.is_household_member(household_id)));
create policy "members can create pets"
on public.pets for insert to authenticated
with check ((select private.is_household_member(household_id)));
create policy "members can update pets"
on public.pets for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));

create policy "members can read routines"
on public.routines for select to authenticated
using ((select private.is_household_member(household_id)));
create policy "members can update routine descriptions"
on public.routines for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));

create policy "members can read routine occurrences"
on public.routine_occurrences for select to authenticated
using ((select private.is_household_member(household_id)));
create policy "members can read routine completions"
on public.routine_completions for select to authenticated
using ((select private.is_household_member(household_id)));
create policy "members can read activity events"
on public.activity_events for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "members can read routine reminder preferences"
on public.routine_reminder_preferences for select to authenticated
using ((select private.is_household_member(household_id)));
create policy "members can create their reminder preferences"
on public.routine_reminder_preferences for insert to authenticated
with check (
  member_id = (select auth.uid())
  and (select private.is_household_member(household_id))
);
create policy "members can update their reminder preferences"
on public.routine_reminder_preferences for update to authenticated
using (
  member_id = (select auth.uid())
  and (select private.is_household_member(household_id))
)
with check (
  member_id = (select auth.uid())
  and (select private.is_household_member(household_id))
);

create policy "members can read their reminder candidates"
on public.reminder_candidates for select to authenticated
using (
  member_id = (select auth.uid())
  and (select private.is_household_member(household_id))
);

revoke all on table public.areas from anon, authenticated;
revoke all on table public.pets from anon, authenticated;
revoke all on table public.routines from anon, authenticated;
revoke all on table public.routine_occurrences from anon, authenticated;
revoke all on table public.routine_completions from anon, authenticated;
revoke all on table public.routine_command_receipts from anon, authenticated;
revoke all on table public.activity_events from anon, authenticated;
revoke all on table public.routine_reminder_preferences from anon, authenticated;
revoke all on table public.reminder_candidates from anon, authenticated;

grant select, insert on table public.areas to authenticated;
grant update (name, sort_order, archived_at) on table public.areas to authenticated;
grant select, insert on table public.pets to authenticated;
grant update (name, photo_path, archived_at) on table public.pets to authenticated;
grant select on table public.routines to authenticated;
grant update (title, instructions, area_id, pet_id, priority)
  on table public.routines to authenticated;
grant select on table public.routine_occurrences to authenticated;
grant select on table public.routine_completions to authenticated;
grant select on table public.activity_events to authenticated;
grant select, insert on table public.routine_reminder_preferences to authenticated;
grant update (enabled, due_day_local_time)
  on table public.routine_reminder_preferences to authenticated;
grant select on table public.reminder_candidates to authenticated;

revoke all on table public.areas from service_role;
revoke all on table public.pets from service_role;
revoke all on table public.routines from service_role;
revoke all on table public.routine_occurrences from service_role;
revoke all on table public.routine_completions from service_role;
revoke all on table public.routine_command_receipts from service_role;
revoke all on table public.activity_events from service_role;
revoke all on table public.routine_reminder_preferences from service_role;
revoke all on table public.reminder_candidates from service_role;

grant select, insert, update, delete on table public.areas to service_role;
grant select, insert, update, delete on table public.pets to service_role;
grant select, insert, update, delete on table public.routines to service_role;
grant select, insert, update, delete on table public.routine_occurrences to service_role;
grant select, insert on table public.routine_completions to service_role;
grant select, insert on table public.routine_command_receipts to service_role;
grant select, insert on table public.activity_events to service_role;
grant select, insert, update, delete
  on table public.routine_reminder_preferences to service_role;
grant select, insert, update, delete on table public.reminder_candidates to service_role;

revoke all on function private.first_routine_due_date(jsonb, date)
from public, anon, authenticated;
revoke all on function private.next_routine_due_date(jsonb, date, date)
from public, anon, authenticated;
revoke all on function private.next_routine_assignee(uuid, text, uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function private.create_reminder_candidates_for_occurrence(uuid)
from public, anon, authenticated;
revoke all on function private.insert_open_routine_occurrence(
  public.routines, text, date, uuid
) from public, anon, authenticated;
revoke all on function private.ensure_routine_window(uuid, date, uuid)
from public, anon, authenticated;
revoke all on function private.seed_default_areas()
from public, anon, authenticated;
revoke all on function private.set_routine_updated_at()
from public, anon, authenticated;
revoke all on function private.sync_routine_reminder_preference()
from public, anon, authenticated;
revoke all on function private.apply_routine_closure(
  uuid, text, text, date, date, text, text
) from public, anon, authenticated;

revoke execute on function public.create_routine(
  uuid, text, uuid, text, text, jsonb, uuid, uuid, text, uuid, text, date, date
) from public, anon;
revoke execute on function public.complete_occurrence(uuid, text, date, text, text)
from public, anon;
revoke execute on function public.skip_occurrence(uuid, text)
from public, anon;
revoke execute on function public.reschedule_occurrence(uuid, date, text)
from public, anon;
revoke execute on function public.pause_routine(uuid)
from public, anon;
revoke execute on function public.unpause_routine(uuid)
from public, anon;
revoke execute on function public.archive_routine(uuid)
from public, anon;

grant execute on function public.create_routine(
  uuid, text, uuid, text, text, jsonb, uuid, uuid, text, uuid, text, date, date
) to authenticated;
grant execute on function public.complete_occurrence(uuid, text, date, text, text)
to authenticated;
grant execute on function public.skip_occurrence(uuid, text)
to authenticated;
grant execute on function public.reschedule_occurrence(uuid, date, text)
to authenticated;
grant execute on function public.pause_routine(uuid)
to authenticated;
grant execute on function public.unpause_routine(uuid)
to authenticated;
grant execute on function public.archive_routine(uuid)
to authenticated;
-- M2 routine engine: areas, pets, routines, occurrences, closures, activity, reminders.

CREATE TABLE public.routine_occurrences (
    id uuid DEFAULT extensions.gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    routine_id uuid NOT NULL,
    due_date date NOT NULL,
    original_due_date date NOT NULL,
    planned_assignee_id uuid,
    status text NOT NULL,
    role text,
    rescheduled_at timestamp with time zone,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT routine_occurrences_closed_at_ck CHECK ((((status = 'open'::text) AND (closed_at IS NULL)) OR ((status <> 'open'::text) AND (closed_at IS NOT NULL)))),
    CONSTRAINT routine_occurrences_role_check CHECK ((role = ANY (ARRAY['current'::text, 'preview'::text]))),
    CONSTRAINT routine_occurrences_role_status_ck CHECK ((((status = 'open'::text) AND (role IS NOT NULL)) OR ((status <> 'open'::text) AND (role IS NULL)))),
    CONSTRAINT routine_occurrences_status_check CHECK ((status = ANY (ARRAY['open'::text, 'completed'::text, 'skipped'::text])))
);

CREATE TABLE public.routines (
    id uuid DEFAULT extensions.gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    title text NOT NULL,
    instructions text,
    area_id uuid NOT NULL,
    pet_id uuid,
    assignment_policy text NOT NULL,
    assigned_member_id uuid,
    rotation_anchor_member_id uuid,
    schedule_kind text NOT NULL,
    schedule_rule jsonb NOT NULL,
    priority text NOT NULL,
    active_from date,
    active_until date,
    paused_at timestamp with time zone,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT routines_active_range_ck CHECK (((active_from IS NULL) OR (active_until IS NULL) OR (active_from <= active_until))),
    CONSTRAINT routines_assignment_ck CHECK ((((assignment_policy = 'assigned'::text) AND (assigned_member_id IS NOT NULL) AND (rotation_anchor_member_id IS NULL)) OR ((assignment_policy = 'alternating'::text) AND (rotation_anchor_member_id IS NOT NULL) AND (assigned_member_id IS NULL)) OR ((assignment_policy = 'shared'::text) AND (assigned_member_id IS NULL) AND (rotation_anchor_member_id IS NULL)))),
    CONSTRAINT routines_assignment_policy_check CHECK ((assignment_policy = ANY (ARRAY['assigned'::text, 'alternating'::text, 'shared'::text]))),
    CONSTRAINT routines_priority_check CHECK ((priority = ANY (ARRAY['pet_care'::text, 'meal_deadline'::text, 'cleaning'::text, 'general'::text]))),
    CONSTRAINT routines_schedule_kind_check CHECK ((schedule_kind = ANY (ARRAY['one_off'::text, 'calendar'::text, 'after_completion'::text]))),
    CONSTRAINT routines_title_check CHECK (((length(TRIM(BOTH FROM title)) >= 1) AND (length(TRIM(BOTH FROM title)) <= 160)))
);

CREATE TABLE public.activity_events (
    id uuid DEFAULT extensions.gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    actor_member_id uuid,
    kind text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT activity_events_entity_type_check CHECK (((length(TRIM(BOTH FROM entity_type)) >= 1) AND (length(TRIM(BOTH FROM entity_type)) <= 80))),
    CONSTRAINT activity_events_kind_check CHECK (((length(TRIM(BOTH FROM kind)) >= 1) AND (length(TRIM(BOTH FROM kind)) <= 80)))
);

CREATE TABLE public.areas (
    id uuid DEFAULT extensions.gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer NOT NULL,
    archived_at timestamp with time zone,
    CONSTRAINT areas_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 80))),
    CONSTRAINT areas_sort_order_check CHECK ((sort_order >= 0))
);

CREATE TABLE public.pets (
    id uuid DEFAULT extensions.gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    name text NOT NULL,
    photo_path text,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pets_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 80)))
);

CREATE TABLE public.reminder_candidates (
    id uuid DEFAULT extensions.gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    member_id uuid NOT NULL,
    occurrence_id uuid NOT NULL,
    remind_on date NOT NULL,
    remind_local_time time without time zone NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reminder_candidates_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'cancelled'::text, 'delivered'::text])))
);

CREATE TABLE public.routine_command_receipts (
    household_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    command_kind text NOT NULL,
    occurrence_id uuid,
    result jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT routine_command_receipts_command_kind_check CHECK ((command_kind = ANY (ARRAY['complete'::text, 'skip'::text, 'reschedule'::text]))),
    CONSTRAINT routine_command_receipts_idempotency_key_check CHECK (((length(TRIM(BOTH FROM idempotency_key)) >= 1) AND (length(TRIM(BOTH FROM idempotency_key)) <= 200)))
);

CREATE TABLE public.routine_completions (
    occurrence_id uuid NOT NULL,
    household_id uuid NOT NULL,
    completed_by_member_id uuid NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_on date NOT NULL,
    note text,
    photo_path text
);

CREATE TABLE public.routine_reminder_preferences (
    routine_id uuid NOT NULL,
    member_id uuid NOT NULL,
    household_id uuid NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    due_day_local_time time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL
);

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_household_id_name_key UNIQUE (household_id, name);

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pets
    ADD CONSTRAINT pets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reminder_candidates
    ADD CONSTRAINT reminder_candidates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.routine_command_receipts
    ADD CONSTRAINT routine_command_receipts_pkey PRIMARY KEY (household_id, idempotency_key);

ALTER TABLE ONLY public.routine_completions
    ADD CONSTRAINT routine_completions_pkey PRIMARY KEY (occurrence_id);

ALTER TABLE ONLY public.routine_occurrences
    ADD CONSTRAINT routine_occurrences_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.routine_reminder_preferences
    ADD CONSTRAINT routine_reminder_preferences_pkey PRIMARY KEY (routine_id, member_id);

ALTER TABLE ONLY public.routines
    ADD CONSTRAINT routines_pkey PRIMARY KEY (id);

CREATE INDEX activity_events_household_created_idx ON public.activity_events USING btree (household_id, created_at DESC);

CREATE UNIQUE INDEX areas_household_id_id_uidx ON public.areas USING btree (household_id, id);

CREATE UNIQUE INDEX pets_household_id_id_uidx ON public.pets USING btree (household_id, id);

CREATE UNIQUE INDEX reminder_candidates_pending_uidx ON public.reminder_candidates USING btree (occurrence_id, member_id) WHERE (status = 'pending'::text);

CREATE INDEX routine_occurrences_household_due_idx ON public.routine_occurrences USING btree (household_id, due_date);

CREATE UNIQUE INDEX routine_occurrences_one_current_uidx ON public.routine_occurrences USING btree (routine_id) WHERE ((status = 'open'::text) AND (role = 'current'::text));

CREATE UNIQUE INDEX routine_occurrences_one_preview_uidx ON public.routine_occurrences USING btree (routine_id) WHERE ((status = 'open'::text) AND (role = 'preview'::text));

CREATE UNIQUE INDEX routines_household_id_id_uidx ON public.routines USING btree (household_id, id);

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_actor_fk FOREIGN KEY (household_id, actor_member_id) REFERENCES public.household_members(household_id, user_id);

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pets
    ADD CONSTRAINT pets_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reminder_candidates
    ADD CONSTRAINT reminder_candidates_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reminder_candidates
    ADD CONSTRAINT reminder_candidates_member_fk FOREIGN KEY (household_id, member_id) REFERENCES public.household_members(household_id, user_id);

ALTER TABLE ONLY public.reminder_candidates
    ADD CONSTRAINT reminder_candidates_occurrence_id_fkey FOREIGN KEY (occurrence_id) REFERENCES public.routine_occurrences(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.routine_command_receipts
    ADD CONSTRAINT routine_command_receipts_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.routine_command_receipts
    ADD CONSTRAINT routine_command_receipts_occurrence_id_fkey FOREIGN KEY (occurrence_id) REFERENCES public.routine_occurrences(id);

ALTER TABLE ONLY public.routine_completions
    ADD CONSTRAINT routine_completions_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.routine_completions
    ADD CONSTRAINT routine_completions_member_fk FOREIGN KEY (household_id, completed_by_member_id) REFERENCES public.household_members(household_id, user_id);

ALTER TABLE ONLY public.routine_completions
    ADD CONSTRAINT routine_completions_occurrence_id_fkey FOREIGN KEY (occurrence_id) REFERENCES public.routine_occurrences(id);

ALTER TABLE ONLY public.routine_occurrences
    ADD CONSTRAINT routine_occurrences_assignee_fk FOREIGN KEY (household_id, planned_assignee_id) REFERENCES public.household_members(household_id, user_id);

ALTER TABLE ONLY public.routine_occurrences
    ADD CONSTRAINT routine_occurrences_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.routine_occurrences
    ADD CONSTRAINT routine_occurrences_routine_fk FOREIGN KEY (household_id, routine_id) REFERENCES public.routines(household_id, id) ON DELETE CASCADE;

ALTER TABLE ONLY public.routine_reminder_preferences
    ADD CONSTRAINT routine_reminder_preferences_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.routine_reminder_preferences
    ADD CONSTRAINT routine_reminder_preferences_member_fk FOREIGN KEY (household_id, member_id) REFERENCES public.household_members(household_id, user_id);

ALTER TABLE ONLY public.routine_reminder_preferences
    ADD CONSTRAINT routine_reminder_preferences_routine_fk FOREIGN KEY (household_id, routine_id) REFERENCES public.routines(household_id, id) ON DELETE CASCADE;

ALTER TABLE ONLY public.routines
    ADD CONSTRAINT routines_area_household_fk FOREIGN KEY (household_id, area_id) REFERENCES public.areas(household_id, id);

ALTER TABLE ONLY public.routines
    ADD CONSTRAINT routines_assigned_member_fk FOREIGN KEY (household_id, assigned_member_id) REFERENCES public.household_members(household_id, user_id);

ALTER TABLE ONLY public.routines
    ADD CONSTRAINT routines_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.routines
    ADD CONSTRAINT routines_pet_household_fk FOREIGN KEY (household_id, pet_id) REFERENCES public.pets(household_id, id);

ALTER TABLE ONLY public.routines
    ADD CONSTRAINT routines_rotation_anchor_fk FOREIGN KEY (household_id, rotation_anchor_member_id) REFERENCES public.household_members(household_id, user_id);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can insert areas" ON public.areas FOR INSERT TO authenticated WITH CHECK (( SELECT private.is_household_member(areas.household_id) AS is_household_member));

CREATE POLICY "members can insert pets" ON public.pets FOR INSERT TO authenticated WITH CHECK (( SELECT private.is_household_member(pets.household_id) AS is_household_member));

CREATE POLICY "members can insert reminder preferences" ON public.routine_reminder_preferences FOR INSERT TO authenticated WITH CHECK (( SELECT private.is_household_member(routine_reminder_preferences.household_id) AS is_household_member));

CREATE POLICY "members can read activity" ON public.activity_events FOR SELECT TO authenticated USING (( SELECT private.is_household_member(activity_events.household_id) AS is_household_member));

CREATE POLICY "members can read areas" ON public.areas FOR SELECT TO authenticated USING (( SELECT private.is_household_member(areas.household_id) AS is_household_member));

CREATE POLICY "members can read completions" ON public.routine_completions FOR SELECT TO authenticated USING (( SELECT private.is_household_member(routine_completions.household_id) AS is_household_member));

CREATE POLICY "members can read occurrences" ON public.routine_occurrences FOR SELECT TO authenticated USING (( SELECT private.is_household_member(routine_occurrences.household_id) AS is_household_member));

CREATE POLICY "members can read pets" ON public.pets FOR SELECT TO authenticated USING (( SELECT private.is_household_member(pets.household_id) AS is_household_member));

CREATE POLICY "members can read reminder candidates" ON public.reminder_candidates FOR SELECT TO authenticated USING (( SELECT private.is_household_member(reminder_candidates.household_id) AS is_household_member));

CREATE POLICY "members can read reminder preferences" ON public.routine_reminder_preferences FOR SELECT TO authenticated USING (( SELECT private.is_household_member(routine_reminder_preferences.household_id) AS is_household_member));

CREATE POLICY "members can read routines" ON public.routines FOR SELECT TO authenticated USING (( SELECT private.is_household_member(routines.household_id) AS is_household_member));

CREATE POLICY "members can update areas" ON public.areas FOR UPDATE TO authenticated USING (( SELECT private.is_household_member(areas.household_id) AS is_household_member)) WITH CHECK (( SELECT private.is_household_member(areas.household_id) AS is_household_member));

CREATE POLICY "members can update pets" ON public.pets FOR UPDATE TO authenticated USING (( SELECT private.is_household_member(pets.household_id) AS is_household_member)) WITH CHECK (( SELECT private.is_household_member(pets.household_id) AS is_household_member));

CREATE POLICY "members can update reminder preferences" ON public.routine_reminder_preferences FOR UPDATE TO authenticated USING (( SELECT private.is_household_member(routine_reminder_preferences.household_id) AS is_household_member)) WITH CHECK (( SELECT private.is_household_member(routine_reminder_preferences.household_id) AS is_household_member));

CREATE POLICY "members can update routine descriptors" ON public.routines FOR UPDATE TO authenticated USING (( SELECT private.is_household_member(routines.household_id) AS is_household_member)) WITH CHECK (( SELECT private.is_household_member(routines.household_id) AS is_household_member));

ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reminder_candidates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.routine_command_receipts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.routine_completions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.routine_occurrences ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.routine_reminder_preferences ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;


CREATE OR REPLACE FUNCTION private.add_days(target date, days integer)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select (target + days)::date;
$function$
;
CREATE OR REPLACE FUNCTION private.apply_closure_succession(p_routine routines, p_closed routine_occurrences, p_completed_on date, p_member_a uuid, p_member_b uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  preview_row public.routine_occurrences;
  first_due date;
  second_due date;
  current_assignee uuid;
  preview_assignee uuid;
  active boolean;
begin
  active := private.routine_is_active(
    p_routine,
    coalesce(p_completed_on, p_closed.due_date)
  );

  select *
  into preview_row
  from public.routine_occurrences
  where routine_id = p_routine.id
    and status = 'open'
    and role = 'preview'
  for update;

  if not active then
    if preview_row.id is not null then
      perform private.cancel_reminder_candidates(preview_row.id);
      delete from public.routine_occurrences where id = preview_row.id;
    end if;
    return;
  end if;

  first_due := private.next_due_after_closure(
    p_routine.schedule_rule,
    p_closed.due_date,
    p_completed_on
  );

  if first_due is null then
    if preview_row.id is not null then
      perform private.cancel_reminder_candidates(preview_row.id);
      delete from public.routine_occurrences where id = preview_row.id;
    end if;
    return;
  end if;

  if preview_row.id is not null
    and (p_routine.schedule_rule ->> 'kind') <> 'after_completion'
    and preview_row.due_date = first_due
  then
    update public.routine_occurrences
    set role = 'current'
    where id = preview_row.id;

    second_due := private.next_due_after_closure(
      p_routine.schedule_rule,
      preview_row.due_date,
      null
    );

    if second_due is not null then
      preview_assignee := private.next_planned_assignee(
        p_routine.assignment_policy,
        p_routine.assigned_member_id,
        p_routine.rotation_anchor_member_id,
        p_member_a,
        p_member_b,
        preview_row.planned_assignee_id
      );
      perform private.insert_open_occurrence(
        p_routine.household_id,
        p_routine.id,
        'preview',
        second_due,
        preview_assignee
      );
    end if;
    return;
  end if;

  if preview_row.id is not null then
    perform private.cancel_reminder_candidates(preview_row.id);
    delete from public.routine_occurrences where id = preview_row.id;
  end if;

  current_assignee := private.next_planned_assignee(
    p_routine.assignment_policy,
    p_routine.assigned_member_id,
    p_routine.rotation_anchor_member_id,
    p_member_a,
    p_member_b,
    p_closed.planned_assignee_id
  );

  perform private.insert_open_occurrence(
    p_routine.household_id,
    p_routine.id,
    'current',
    first_due,
    current_assignee
  );

  second_due := private.next_due_after_closure(
    p_routine.schedule_rule,
    first_due,
    null
  );

  if second_due is not null then
    preview_assignee := private.next_planned_assignee(
      p_routine.assignment_policy,
      p_routine.assigned_member_id,
      p_routine.rotation_anchor_member_id,
      p_member_a,
      p_member_b,
      current_assignee
    );
    perform private.insert_open_occurrence(
      p_routine.household_id,
      p_routine.id,
      'preview',
      second_due,
      preview_assignee
    );
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.cancel_reminder_candidates(p_occurrence_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update public.reminder_candidates
  set status = 'cancelled'
  where occurrence_id = p_occurrence_id
    and status = 'pending';
$function$
;
CREATE OR REPLACE FUNCTION private.create_reminder_candidates_for_occurrence(p_household_id uuid, p_routine_id uuid, p_occurrence_id uuid, p_due_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.reminder_candidates (
    household_id,
    member_id,
    occurrence_id,
    remind_on,
    remind_local_time,
    status
  )
  select
    p_household_id,
    pref.member_id,
    p_occurrence_id,
    p_due_date,
    pref.due_day_local_time,
    'pending'
  from public.routine_reminder_preferences pref
  where pref.routine_id = p_routine_id
    and pref.household_id = p_household_id
    and pref.enabled;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.first_due_date_on_or_after(p_rule jsonb, p_from date)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  rule_kind text := p_rule ->> 'kind';
  days integer[];
  every_n integer;
  unit text;
begin
  case rule_kind
    when 'one_off' then
      return (p_rule ->> 'date')::date;
    when 'daily' then
      return p_from;
    when 'weekdays' then
      days := array(
        select (value::text)::integer
        from jsonb_array_elements_text(p_rule -> 'days')
      );
      if private.iso_weekday(p_from) = any (days) then
        return p_from;
      end if;
      return private.next_calendar_due_date(p_rule, p_from);
    when 'weekly' then
      return private.add_days(
        p_from,
        (((p_rule ->> 'weekday')::integer - private.iso_weekday(p_from)) + 7) % 7
      );
    when 'monthly' then
      return private.next_calendar_due_date(
        p_rule,
        private.add_days(p_from, -1)
      );
    when 'after_completion' then
      every_n := (p_rule ->> 'every')::integer;
      unit := p_rule ->> 'unit';
      return private.add_days(
        p_from,
        case when unit = 'weeks' then every_n * 7 else every_n end
      );
    else
      raise exception 'unsupported schedule_rule.kind %', rule_kind;
  end case;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.household_member_pair(p_household_id uuid)
 RETURNS TABLE(member_a uuid, member_b uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (array_agg(user_id order by joined_at, user_id))[1],
    (array_agg(user_id order by joined_at, user_id))[2]
  from public.household_members
  where household_id = p_household_id;
$function$
;
CREATE OR REPLACE FUNCTION private.insert_open_occurrence(p_household_id uuid, p_routine_id uuid, p_role text, p_due_date date, p_planned_assignee_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  new_id uuid;
begin
  insert into public.routine_occurrences (
    household_id,
    routine_id,
    due_date,
    original_due_date,
    planned_assignee_id,
    status,
    role
  )
  values (
    p_household_id,
    p_routine_id,
    p_due_date,
    p_due_date,
    p_planned_assignee_id,
    'open',
    p_role
  )
  returning id into new_id;

  perform private.create_reminder_candidates_for_occurrence(
    p_household_id,
    p_routine_id,
    new_id,
    p_due_date
  );

  return new_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.iso_weekday(target date)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select extract(isodow from target)::integer;
$function$
;
CREATE OR REPLACE FUNCTION private.next_calendar_due_date(p_rule jsonb, p_after date)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  rule_kind text := p_rule ->> 'kind';
  candidate date;
  weekday integer;
  day_of_month integer;
  days integer[];
  step integer;
begin
  case rule_kind
    when 'daily' then
      return private.add_days(p_after, 1);
    when 'weekly' then
      weekday := (p_rule ->> 'weekday')::integer;
      candidate := private.add_days(p_after, 1);
      return private.add_days(
        candidate,
        ((weekday - private.iso_weekday(candidate)) + 7) % 7
      );
    when 'weekdays' then
      days := array(
        select (value::text)::integer
        from jsonb_array_elements_text(p_rule -> 'days')
      );
      candidate := private.add_days(p_after, 1);
      for step in 0..7 loop
        if private.iso_weekday(candidate) = any (days) then
          return candidate;
        end if;
        candidate := private.add_days(candidate, 1);
      end loop;
      raise exception 'failed to find next weekday match';
    when 'monthly' then
      day_of_month := (p_rule ->> 'dayOfMonth')::integer;
      candidate := private.add_days(p_after, 1);
      declare
        y integer := extract(year from candidate)::integer;
        m integer := extract(month from candidate)::integer;
        dim integer;
        clamped integer;
        this_month date;
      begin
        dim := extract(day from (date_trunc('month', candidate) + interval '1 month - 1 day'))::integer;
        clamped := least(day_of_month, dim);
        this_month := make_date(y, m, clamped);
        if this_month >= candidate then
          return this_month;
        end if;
        candidate := (date_trunc('month', candidate) + interval '1 month')::date;
        y := extract(year from candidate)::integer;
        m := extract(month from candidate)::integer;
        dim := extract(day from (date_trunc('month', candidate) + interval '1 month - 1 day'))::integer;
        return make_date(y, m, least(day_of_month, dim));
      end;
    else
      raise exception 'not a calendar schedule rule: %', rule_kind;
  end case;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.next_due_after_closure(p_rule jsonb, p_closed_due date, p_completed_on date DEFAULT NULL::date)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  rule_kind text := p_rule ->> 'kind';
  every_n integer;
  unit text;
  anchor date;
begin
  case rule_kind
    when 'one_off' then
      return null;
    when 'after_completion' then
      every_n := (p_rule ->> 'every')::integer;
      unit := p_rule ->> 'unit';
      anchor := coalesce(p_completed_on, p_closed_due);
      return private.add_days(
        anchor,
        case when unit = 'weeks' then every_n * 7 else every_n end
      );
    when 'daily', 'weekdays', 'weekly', 'monthly' then
      return private.next_calendar_due_date(p_rule, p_closed_due);
    else
      raise exception 'unsupported schedule_rule.kind %', rule_kind;
  end case;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.next_planned_assignee(p_policy text, p_assigned_member_id uuid, p_rotation_anchor_member_id uuid, p_member_a uuid, p_member_b uuid, p_previous uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
begin
  case p_policy
    when 'assigned' then
      return p_assigned_member_id;
    when 'shared' then
      return null;
    when 'alternating' then
      if p_previous is null then
        return p_rotation_anchor_member_id;
      end if;
      if p_previous = p_member_a then
        return p_member_b;
      end if;
      if p_previous = p_member_b then
        return p_member_a;
      end if;
      raise exception 'previous planned assignee is not a household member';
    else
      raise exception 'unsupported assignment_policy %', p_policy;
  end case;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.require_caller_member(p_household_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller uuid := auth.uid();
begin
  if caller is null or not private.is_household_member(p_household_id) then
    raise exception 'not a household member';
  end if;
  return caller;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.routine_is_active(p_routine routines, p_on date)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select
    p_routine.archived_at is null
    and p_routine.paused_at is null
    and (p_routine.active_from is null or p_routine.active_from <= p_on)
    and (p_routine.active_until is null or p_routine.active_until >= p_on);
$function$
;
CREATE OR REPLACE FUNCTION private.seed_default_areas(target_household_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.areas (household_id, name, sort_order)
  values
    (target_household_id, 'Cleaning', 1),
    (target_household_id, 'Kitchen', 2),
    (target_household_id, 'Laundry', 3),
    (target_household_id, 'Dog', 4),
    (target_household_id, 'Meals', 5),
    (target_household_id, 'General', 6)
  on conflict (household_id, name) do nothing;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.trg_seed_default_areas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.seed_default_areas(new.id);
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.validate_schedule_rule(p_schedule_kind text, p_rule jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  rule_kind text := p_rule ->> 'kind';
  days integer[];
  day_of_month integer;
  every_n integer;
  unit text;
  weekday integer;
  one_off_date date;
begin
  if rule_kind is null then
    raise exception 'schedule_rule.kind is required';
  end if;

  if p_schedule_kind = 'one_off' and rule_kind <> 'one_off' then
    raise exception 'schedule kind/rule mismatch';
  end if;

  if p_schedule_kind = 'after_completion' and rule_kind <> 'after_completion' then
    raise exception 'schedule kind/rule mismatch';
  end if;

  if p_schedule_kind = 'calendar'
    and rule_kind not in ('daily', 'weekdays', 'weekly', 'monthly') then
    raise exception 'schedule kind/rule mismatch';
  end if;

  case rule_kind
    when 'one_off' then
      one_off_date := (p_rule ->> 'date')::date;
      return jsonb_build_object('kind', 'one_off', 'date', one_off_date);
    when 'daily' then
      return jsonb_build_object('kind', 'daily');
    when 'weekdays' then
      days := array(
        select distinct (value::text)::integer
        from jsonb_array_elements_text(coalesce(p_rule -> 'days', '[]'::jsonb))
        order by 1
      );
      if coalesce(cardinality(days), 0) = 0 then
        raise exception 'weekdays requires at least one day';
      end if;
      if exists (select 1 from unnest(days) d where d < 1 or d > 7) then
        raise exception 'weekdays must be ISO weekdays 1-7';
      end if;
      return jsonb_build_object('kind', 'weekdays', 'days', to_jsonb(days));
    when 'weekly' then
      weekday := (p_rule ->> 'weekday')::integer;
      if weekday is null or weekday < 1 or weekday > 7 then
        raise exception 'weekly weekday must be ISO weekday 1-7';
      end if;
      return jsonb_build_object('kind', 'weekly', 'weekday', weekday);
    when 'monthly' then
      day_of_month := (p_rule ->> 'dayOfMonth')::integer;
      if day_of_month is null or day_of_month < 1 or day_of_month > 31 then
        raise exception 'monthly dayOfMonth must be 1-31';
      end if;
      return jsonb_build_object('kind', 'monthly', 'dayOfMonth', day_of_month);
    when 'after_completion' then
      every_n := (p_rule ->> 'every')::integer;
      unit := p_rule ->> 'unit';
      if every_n is null or every_n < 1 then
        raise exception 'after_completion every must be a positive integer';
      end if;
      if unit not in ('days', 'weeks') then
        raise exception 'after_completion unit must be days or weeks';
      end if;
      return jsonb_build_object(
        'kind', 'after_completion',
        'every', every_n,
        'unit', unit
      );
    else
      raise exception 'unsupported schedule_rule.kind %', rule_kind;
  end case;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.write_activity(p_household_id uuid, p_actor_member_id uuid, p_kind text, p_entity_type text, p_entity_id uuid, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.activity_events (
    household_id,
    actor_member_id,
    kind,
    entity_type,
    entity_id,
    payload
  )
  values (
    p_household_id,
    p_actor_member_id,
    p_kind,
    p_entity_type,
    p_entity_id,
    coalesce(p_payload, '{}'::jsonb)
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.archive_routine(p_routine_id uuid)
 RETURNS routines
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  routine_row public.routines;
  caller uuid;
  open_row public.routine_occurrences;
begin
  select * into routine_row from public.routines where id = p_routine_id for update;
  if routine_row.id is null then
    raise exception 'routine not found';
  end if;
  caller := private.require_caller_member(routine_row.household_id);

  update public.routines
  set
    archived_at = coalesce(archived_at, now()),
    paused_at = coalesce(paused_at, now()),
    updated_at = now()
  where id = p_routine_id
  returning * into routine_row;

  for open_row in
    select *
    from public.routine_occurrences
    where routine_id = p_routine_id
      and status = 'open'
    for update
  loop
    perform private.cancel_reminder_candidates(open_row.id);
    if open_row.role = 'preview' then
      delete from public.routine_occurrences where id = open_row.id;
    end if;
  end loop;

  perform private.write_activity(
    routine_row.household_id,
    caller,
    'routine_archived',
    'routine',
    routine_row.id,
    '{}'::jsonb
  );

  return routine_row;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.complete_occurrence(p_occurrence_id uuid, p_idempotency_key text, p_completed_on date, p_note text DEFAULT NULL::text, p_photo_path text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  occurrence_row public.routine_occurrences;
  routine_row public.routines;
  caller uuid;
  member_a uuid;
  member_b uuid;
  existing jsonb;
  result_payload jsonb;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key is required';
  end if;

  select *
  into occurrence_row
  from public.routine_occurrences
  where id = p_occurrence_id
  for update;

  if occurrence_row.id is null then
    raise exception 'occurrence not found';
  end if;

  caller := private.require_caller_member(occurrence_row.household_id);

  select receipts.result
  into existing
  from public.routine_command_receipts as receipts
  where household_id = occurrence_row.household_id
    and idempotency_key = p_idempotency_key;

  if existing is not null then
    return existing;
  end if;

  if occurrence_row.status <> 'open' or occurrence_row.role <> 'current' then
    raise exception 'only the open current occurrence can be completed';
  end if;

  select *
  into routine_row
  from public.routines
  where id = occurrence_row.routine_id
  for update;

  select h.member_a, h.member_b
  into member_a, member_b
  from private.household_member_pair(occurrence_row.household_id) h;

  update public.routine_occurrences
  set
    status = 'completed',
    role = null,
    closed_at = now()
  where id = occurrence_row.id;

  insert into public.routine_completions (
    occurrence_id,
    household_id,
    completed_by_member_id,
    completed_on,
    note,
    photo_path
  )
  values (
    occurrence_row.id,
    occurrence_row.household_id,
    caller,
    p_completed_on,
    p_note,
    p_photo_path
  );

  perform private.cancel_reminder_candidates(occurrence_row.id);
  perform private.apply_closure_succession(
    routine_row,
    occurrence_row,
    p_completed_on,
    member_a,
    member_b
  );
  perform private.write_activity(
    occurrence_row.household_id,
    caller,
    'occurrence_completed',
    'routine_occurrence',
    occurrence_row.id,
    jsonb_build_object('routine_id', routine_row.id, 'completed_on', p_completed_on)
  );

  result_payload := jsonb_build_object(
    'occurrence_id', occurrence_row.id,
    'status', 'completed'
  );

  insert into public.routine_command_receipts (
    household_id,
    idempotency_key,
    command_kind,
    occurrence_id,
    result
  )
  values (
    occurrence_row.household_id,
    p_idempotency_key,
    'complete',
    occurrence_row.id,
    result_payload
  );

  return result_payload;
exception
  when unique_violation then
    select receipts.result
    into existing
    from public.routine_command_receipts as receipts
    where household_id = occurrence_row.household_id
      and idempotency_key = p_idempotency_key;
    if existing is not null then
      return existing;
    end if;
    raise;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_routine(p_household_id uuid, p_title text, p_area_id uuid, p_assignment_policy text, p_schedule_kind text, p_schedule_rule jsonb, p_priority text, p_instructions text DEFAULT NULL::text, p_pet_id uuid DEFAULT NULL::uuid, p_assigned_member_id uuid DEFAULT NULL::uuid, p_rotation_anchor_member_id uuid DEFAULT NULL::uuid, p_active_from date DEFAULT NULL::date, p_active_until date DEFAULT NULL::date, p_first_due_on date DEFAULT NULL::date)
 RETURNS routines
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller uuid;
  validated_rule jsonb;
  member_a uuid;
  member_b uuid;
  routine_row public.routines;
  first_due date;
  second_due date;
  current_assignee uuid;
  preview_assignee uuid;
  start_on date;
begin
  caller := private.require_caller_member(p_household_id);
  validated_rule := private.validate_schedule_rule(p_schedule_kind, p_schedule_rule);

  select h.member_a, h.member_b
  into member_a, member_b
  from private.household_member_pair(p_household_id) h;

  if member_a is null or member_b is null then
    raise exception 'household must have two members before creating routines';
  end if;

  insert into public.routines (
    household_id,
    title,
    instructions,
    area_id,
    pet_id,
    assignment_policy,
    assigned_member_id,
    rotation_anchor_member_id,
    schedule_kind,
    schedule_rule,
    priority,
    active_from,
    active_until
  )
  values (
    p_household_id,
    trim(p_title),
    p_instructions,
    p_area_id,
    p_pet_id,
    p_assignment_policy,
    p_assigned_member_id,
    p_rotation_anchor_member_id,
    p_schedule_kind,
    validated_rule,
    p_priority,
    p_active_from,
    p_active_until
  )
  returning * into routine_row;

  start_on := coalesce(p_first_due_on, timezone('Europe/Zurich', now())::date);
  first_due := private.first_due_date_on_or_after(validated_rule, start_on);

  if private.routine_is_active(routine_row, first_due) then
    current_assignee := private.next_planned_assignee(
      routine_row.assignment_policy,
      routine_row.assigned_member_id,
      routine_row.rotation_anchor_member_id,
      member_a,
      member_b,
      null
    );

    perform private.insert_open_occurrence(
      p_household_id,
      routine_row.id,
      'current',
      first_due,
      current_assignee
    );

    second_due := private.next_due_after_closure(validated_rule, first_due, null);
    if second_due is not null then
      preview_assignee := private.next_planned_assignee(
        routine_row.assignment_policy,
        routine_row.assigned_member_id,
        routine_row.rotation_anchor_member_id,
        member_a,
        member_b,
        current_assignee
      );
      perform private.insert_open_occurrence(
        p_household_id,
        routine_row.id,
        'preview',
        second_due,
        preview_assignee
      );
    end if;
  end if;

  perform private.write_activity(
    p_household_id,
    caller,
    'routine_created',
    'routine',
    routine_row.id,
    jsonb_build_object('title', routine_row.title)
  );

  return routine_row;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.pause_routine(p_routine_id uuid)
 RETURNS routines
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  routine_row public.routines;
  caller uuid;
begin
  select * into routine_row from public.routines where id = p_routine_id for update;
  if routine_row.id is null then
    raise exception 'routine not found';
  end if;
  caller := private.require_caller_member(routine_row.household_id);
  if routine_row.archived_at is not null then
    raise exception 'archived routines cannot be paused';
  end if;
  update public.routines
  set paused_at = coalesce(paused_at, now()), updated_at = now()
  where id = p_routine_id
  returning * into routine_row;
  perform private.write_activity(
    routine_row.household_id,
    caller,
    'routine_paused',
    'routine',
    routine_row.id,
    '{}'::jsonb
  );
  return routine_row;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.reschedule_occurrence(p_occurrence_id uuid, p_new_due_date date, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  occurrence_row public.routine_occurrences;
  routine_row public.routines;
  caller uuid;
  member_a uuid;
  member_b uuid;
  preview_row public.routine_occurrences;
  preview_due date;
  preview_assignee uuid;
  existing jsonb;
  result_payload jsonb;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key is required';
  end if;

  select *
  into occurrence_row
  from public.routine_occurrences
  where id = p_occurrence_id
  for update;

  if occurrence_row.id is null then
    raise exception 'occurrence not found';
  end if;

  caller := private.require_caller_member(occurrence_row.household_id);

  select receipts.result
  into existing
  from public.routine_command_receipts as receipts
  where household_id = occurrence_row.household_id
    and idempotency_key = p_idempotency_key;

  if existing is not null then
    return existing;
  end if;

  if occurrence_row.status <> 'open' or occurrence_row.role <> 'current' then
    raise exception 'only the open current occurrence can be rescheduled';
  end if;

  if p_new_due_date = occurrence_row.due_date then
    raise exception 'reschedule date must differ from the current due date';
  end if;

  select *
  into routine_row
  from public.routines
  where id = occurrence_row.routine_id
  for update;

  select h.member_a, h.member_b
  into member_a, member_b
  from private.household_member_pair(occurrence_row.household_id) h;

  update public.routine_occurrences
  set
    due_date = p_new_due_date,
    rescheduled_at = now()
  where id = occurrence_row.id;

  select *
  into preview_row
  from public.routine_occurrences
  where routine_id = routine_row.id
    and status = 'open'
    and role = 'preview'
  for update;

  if preview_row.id is not null then
    perform private.cancel_reminder_candidates(preview_row.id);
    delete from public.routine_occurrences where id = preview_row.id;
  end if;

  if private.routine_is_active(routine_row, p_new_due_date) then
    preview_due := private.next_due_after_closure(
      routine_row.schedule_rule,
      p_new_due_date,
      null
    );
    if preview_due is not null then
      preview_assignee := private.next_planned_assignee(
        routine_row.assignment_policy,
        routine_row.assigned_member_id,
        routine_row.rotation_anchor_member_id,
        member_a,
        member_b,
        occurrence_row.planned_assignee_id
      );
      perform private.insert_open_occurrence(
        routine_row.household_id,
        routine_row.id,
        'preview',
        preview_due,
        preview_assignee
      );
    end if;
  end if;

  perform private.cancel_reminder_candidates(occurrence_row.id);
  perform private.create_reminder_candidates_for_occurrence(
    occurrence_row.household_id,
    routine_row.id,
    occurrence_row.id,
    p_new_due_date
  );

  perform private.write_activity(
    occurrence_row.household_id,
    caller,
    'occurrence_rescheduled',
    'routine_occurrence',
    occurrence_row.id,
    jsonb_build_object('new_due_date', p_new_due_date)
  );

  result_payload := jsonb_build_object(
    'occurrence_id', occurrence_row.id,
    'status', 'open',
    'due_date', p_new_due_date
  );

  insert into public.routine_command_receipts (
    household_id,
    idempotency_key,
    command_kind,
    occurrence_id,
    result
  )
  values (
    occurrence_row.household_id,
    p_idempotency_key,
    'reschedule',
    occurrence_row.id,
    result_payload
  );

  return result_payload;
exception
  when unique_violation then
    select receipts.result
    into existing
    from public.routine_command_receipts as receipts
    where household_id = occurrence_row.household_id
      and idempotency_key = p_idempotency_key;
    if existing is not null then
      return existing;
    end if;
    raise;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.skip_occurrence(p_occurrence_id uuid, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  occurrence_row public.routine_occurrences;
  routine_row public.routines;
  caller uuid;
  member_a uuid;
  member_b uuid;
  existing jsonb;
  result_payload jsonb;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key is required';
  end if;

  select *
  into occurrence_row
  from public.routine_occurrences
  where id = p_occurrence_id
  for update;

  if occurrence_row.id is null then
    raise exception 'occurrence not found';
  end if;

  caller := private.require_caller_member(occurrence_row.household_id);

  select receipts.result
  into existing
  from public.routine_command_receipts as receipts
  where household_id = occurrence_row.household_id
    and idempotency_key = p_idempotency_key;

  if existing is not null then
    return existing;
  end if;

  if occurrence_row.status <> 'open' or occurrence_row.role <> 'current' then
    raise exception 'only the open current occurrence can be skipped';
  end if;

  select *
  into routine_row
  from public.routines
  where id = occurrence_row.routine_id
  for update;

  select h.member_a, h.member_b
  into member_a, member_b
  from private.household_member_pair(occurrence_row.household_id) h;

  update public.routine_occurrences
  set
    status = 'skipped',
    role = null,
    closed_at = now()
  where id = occurrence_row.id;

  perform private.cancel_reminder_candidates(occurrence_row.id);
  perform private.apply_closure_succession(
    routine_row,
    occurrence_row,
    null,
    member_a,
    member_b
  );
  perform private.write_activity(
    occurrence_row.household_id,
    caller,
    'occurrence_skipped',
    'routine_occurrence',
    occurrence_row.id,
    jsonb_build_object('routine_id', routine_row.id)
  );

  result_payload := jsonb_build_object(
    'occurrence_id', occurrence_row.id,
    'status', 'skipped'
  );

  insert into public.routine_command_receipts (
    household_id,
    idempotency_key,
    command_kind,
    occurrence_id,
    result
  )
  values (
    occurrence_row.household_id,
    p_idempotency_key,
    'skip',
    occurrence_row.id,
    result_payload
  );

  return result_payload;
exception
  when unique_violation then
    select receipts.result
    into existing
    from public.routine_command_receipts as receipts
    where household_id = occurrence_row.household_id
      and idempotency_key = p_idempotency_key;
    if existing is not null then
      return existing;
    end if;
    raise;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.unpause_routine(p_routine_id uuid)
 RETURNS routines
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  routine_row public.routines;
  caller uuid;
begin
  select * into routine_row from public.routines where id = p_routine_id for update;
  if routine_row.id is null then
    raise exception 'routine not found';
  end if;
  caller := private.require_caller_member(routine_row.household_id);
  update public.routines
  set paused_at = null, updated_at = now()
  where id = p_routine_id
  returning * into routine_row;
  perform private.write_activity(
    routine_row.household_id,
    caller,
    'routine_unpaused',
    'routine',
    routine_row.id,
    '{}'::jsonb
  );
  return routine_row;
end;
$function$
;

CREATE TRIGGER households_seed_default_areas AFTER INSERT ON public.households FOR EACH ROW EXECUTE FUNCTION private.trg_seed_default_areas();

select private.seed_default_areas(id) from public.households;

alter table public.areas enable row level security;
alter table public.pets enable row level security;
alter table public.routines enable row level security;
alter table public.routine_occurrences enable row level security;
alter table public.routine_completions enable row level security;
alter table public.routine_command_receipts enable row level security;
alter table public.activity_events enable row level security;
alter table public.routine_reminder_preferences enable row level security;
alter table public.reminder_candidates enable row level security;

revoke all on table public.areas from anon, authenticated;
revoke all on table public.areas from service_role;
revoke all on table public.pets from anon, authenticated;
revoke all on table public.pets from service_role;
revoke all on table public.routines from anon, authenticated;
revoke all on table public.routines from service_role;
revoke all on table public.routine_occurrences from anon, authenticated;
revoke all on table public.routine_occurrences from service_role;
revoke all on table public.routine_completions from anon, authenticated;
revoke all on table public.routine_completions from service_role;
revoke all on table public.routine_command_receipts from anon, authenticated;
revoke all on table public.routine_command_receipts from service_role;
revoke all on table public.activity_events from anon, authenticated;
revoke all on table public.activity_events from service_role;
revoke all on table public.routine_reminder_preferences from anon, authenticated;
revoke all on table public.routine_reminder_preferences from service_role;
revoke all on table public.reminder_candidates from anon, authenticated;
revoke all on table public.reminder_candidates from service_role;

grant SELECT on table public.activity_events to authenticated;
grant DELETE on table public.activity_events to service_role;
grant INSERT on table public.activity_events to service_role;
grant SELECT on table public.activity_events to service_role;
grant UPDATE on table public.activity_events to service_role;
grant INSERT on table public.areas to authenticated;
grant SELECT on table public.areas to authenticated;
grant UPDATE on table public.areas to authenticated;
grant DELETE on table public.areas to service_role;
grant INSERT on table public.areas to service_role;
grant SELECT on table public.areas to service_role;
grant UPDATE on table public.areas to service_role;
grant INSERT on table public.pets to authenticated;
grant SELECT on table public.pets to authenticated;
grant UPDATE on table public.pets to authenticated;
grant DELETE on table public.pets to service_role;
grant INSERT on table public.pets to service_role;
grant SELECT on table public.pets to service_role;
grant UPDATE on table public.pets to service_role;
grant SELECT on table public.reminder_candidates to authenticated;
grant DELETE on table public.reminder_candidates to service_role;
grant INSERT on table public.reminder_candidates to service_role;
grant SELECT on table public.reminder_candidates to service_role;
grant UPDATE on table public.reminder_candidates to service_role;
grant DELETE on table public.routine_command_receipts to service_role;
grant INSERT on table public.routine_command_receipts to service_role;
grant SELECT on table public.routine_command_receipts to service_role;
grant UPDATE on table public.routine_command_receipts to service_role;
grant SELECT on table public.routine_completions to authenticated;
grant DELETE on table public.routine_completions to service_role;
grant INSERT on table public.routine_completions to service_role;
grant SELECT on table public.routine_completions to service_role;
grant UPDATE on table public.routine_completions to service_role;
grant SELECT on table public.routine_occurrences to authenticated;
grant DELETE on table public.routine_occurrences to service_role;
grant INSERT on table public.routine_occurrences to service_role;
grant SELECT on table public.routine_occurrences to service_role;
grant UPDATE on table public.routine_occurrences to service_role;
grant INSERT on table public.routine_reminder_preferences to authenticated;
grant SELECT on table public.routine_reminder_preferences to authenticated;
grant UPDATE on table public.routine_reminder_preferences to authenticated;
grant DELETE on table public.routine_reminder_preferences to service_role;
grant INSERT on table public.routine_reminder_preferences to service_role;
grant SELECT on table public.routine_reminder_preferences to service_role;
grant UPDATE on table public.routine_reminder_preferences to service_role;
grant SELECT on table public.routines to authenticated;
grant UPDATE on table public.routines to authenticated;
grant DELETE on table public.routines to service_role;
grant INSERT on table public.routines to service_role;
grant SELECT on table public.routines to service_role;
grant UPDATE on table public.routines to service_role;

create policy "members can read activity" on public.activity_events for select to authenticated using (( SELECT private.is_household_member(activity_events.household_id) AS is_household_member));
create policy "members can insert areas" on public.areas for insert to authenticated with check (( SELECT private.is_household_member(areas.household_id) AS is_household_member));
create policy "members can read areas" on public.areas for select to authenticated using (( SELECT private.is_household_member(areas.household_id) AS is_household_member));
create policy "members can update areas" on public.areas for update to authenticated using (( SELECT private.is_household_member(areas.household_id) AS is_household_member)) with check (( SELECT private.is_household_member(areas.household_id) AS is_household_member));
create policy "members can insert pets" on public.pets for insert to authenticated with check (( SELECT private.is_household_member(pets.household_id) AS is_household_member));
create policy "members can read pets" on public.pets for select to authenticated using (( SELECT private.is_household_member(pets.household_id) AS is_household_member));
create policy "members can update pets" on public.pets for update to authenticated using (( SELECT private.is_household_member(pets.household_id) AS is_household_member)) with check (( SELECT private.is_household_member(pets.household_id) AS is_household_member));
create policy "members can read reminder candidates" on public.reminder_candidates for select to authenticated using (( SELECT private.is_household_member(reminder_candidates.household_id) AS is_household_member));
create policy "members can read completions" on public.routine_completions for select to authenticated using (( SELECT private.is_household_member(routine_completions.household_id) AS is_household_member));
create policy "members can read occurrences" on public.routine_occurrences for select to authenticated using (( SELECT private.is_household_member(routine_occurrences.household_id) AS is_household_member));
create policy "members can insert reminder preferences" on public.routine_reminder_preferences for insert to authenticated with check (( SELECT private.is_household_member(routine_reminder_preferences.household_id) AS is_household_member));
create policy "members can read reminder preferences" on public.routine_reminder_preferences for select to authenticated using (( SELECT private.is_household_member(routine_reminder_preferences.household_id) AS is_household_member));
create policy "members can update reminder preferences" on public.routine_reminder_preferences for update to authenticated using (( SELECT private.is_household_member(routine_reminder_preferences.household_id) AS is_household_member)) with check (( SELECT private.is_household_member(routine_reminder_preferences.household_id) AS is_household_member));
create policy "members can read routines" on public.routines for select to authenticated using (( SELECT private.is_household_member(routines.household_id) AS is_household_member));
create policy "members can update routine descriptors" on public.routines for update to authenticated using (( SELECT private.is_household_member(routines.household_id) AS is_household_member)) with check (( SELECT private.is_household_member(routines.household_id) AS is_household_member));

revoke all on function public.create_routine(uuid, text, uuid, text, text, jsonb, text, text, uuid, uuid, uuid, date, date, date) from public, anon;
revoke all on function public.complete_occurrence(uuid, text, date, text, text) from public, anon;
revoke all on function public.skip_occurrence(uuid, text) from public, anon;
revoke all on function public.reschedule_occurrence(uuid, date, text) from public, anon;
revoke all on function public.pause_routine(uuid) from public, anon;
revoke all on function public.unpause_routine(uuid) from public, anon;
revoke all on function public.archive_routine(uuid) from public, anon;

grant execute on function public.archive_routine(p_routine_id uuid) to authenticated;
grant execute on function public.complete_occurrence(p_occurrence_id uuid, p_idempotency_key text, p_completed_on date, p_note text, p_photo_path text) to authenticated;
grant execute on function public.create_routine(p_household_id uuid, p_title text, p_area_id uuid, p_assignment_policy text, p_schedule_kind text, p_schedule_rule jsonb, p_priority text, p_instructions text, p_pet_id uuid, p_assigned_member_id uuid, p_rotation_anchor_member_id uuid, p_active_from date, p_active_until date, p_first_due_on date) to authenticated;
grant execute on function public.pause_routine(p_routine_id uuid) to authenticated;
grant execute on function public.reschedule_occurrence(p_occurrence_id uuid, p_new_due_date date, p_idempotency_key text) to authenticated;
grant execute on function public.skip_occurrence(p_occurrence_id uuid, p_idempotency_key text) to authenticated;
grant execute on function public.unpause_routine(p_routine_id uuid) to authenticated;
