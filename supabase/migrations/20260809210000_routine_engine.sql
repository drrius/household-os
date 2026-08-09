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
      'routine_updated',
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
    select occurrence.*
    into latest_occurrence
    from public.routine_occurrences as occurrence
    where occurrence.routine_id = routine.id
      and occurrence.status in ('completed', 'skipped')
    order by occurrence.closed_at desc, occurrence.created_at desc
    limit 1;

    if found then
      select completion.completed_on
      into latest_completed_on
      from public.routine_completions as completion
      where completion.occurrence_id = latest_occurrence.id;

      previous_assignee_id := latest_occurrence.planned_assignee_id;
      first_due_date := private.next_routine_due_date(
        routine.schedule_rule,
        latest_occurrence.due_date,
        latest_completed_on
      );
    else
      first_due_date := private.first_routine_due_date(
        routine.schedule_rule,
        greatest(private.household_today(), coalesce(routine.active_from, private.household_today()))
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


create or replace function private.household_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (timezone('Europe/Zurich', now()))::date;
$$;

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
  new_routine_id uuid;
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
    greatest(private.household_today(), coalesce(p_active_from, private.household_today()))
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
  returning id into new_routine_id;

  perform private.ensure_routine_window(new_routine_id, first_due_date, null);

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
    new_routine_id,
    jsonb_build_object('title', trim(p_title))
  );

  select occurrence.id
  into current_occurrence_id
  from public.routine_occurrences as occurrence
  where occurrence.routine_id = new_routine_id
    and occurrence.status = 'open'
    and occurrence.role = 'current';

  select occurrence.id
  into preview_occurrence_id
  from public.routine_occurrences as occurrence
  where occurrence.routine_id = new_routine_id
    and occurrence.status = 'open'
    and occurrence.role = 'preview';

  return jsonb_strip_nulls(
    jsonb_build_object(
      'routine_id', new_routine_id,
      'current_occurrence_id', current_occurrence_id,
      'preview_occurrence_id', preview_occurrence_id
    )
  );
end;
$$;


create or replace function public.update_routine_definition(
  p_routine_id uuid,
  p_title text default null,
  p_instructions text default null,
  p_area_id uuid default null,
  p_pet_id uuid default null,
  p_assignment_policy text default null,
  p_assigned_member_id uuid default null,
  p_rotation_anchor_member_id uuid default null,
  p_schedule_kind text default null,
  p_schedule_rule jsonb default null,
  p_priority text default null,
  p_active_from date default null,
  p_active_until date default null,
  p_rebuild_window boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  routine public.routines%rowtype;
  next_schedule_kind text;
  next_schedule_rule jsonb;
  next_assignment_policy text;
  next_assigned uuid;
  next_rotation uuid;
  open_row public.routine_occurrences%rowtype;
  first_due date;
begin
  select * into routine from public.routines where id = p_routine_id for update;
  if routine.id is null then
    raise exception 'routine % does not exist', p_routine_id using errcode = 'P0002';
  end if;
  if actor_member_id is null or not private.is_household_member(routine.household_id) then
    raise exception 'caller is not a member of household %', routine.household_id
      using errcode = '42501';
  end if;
  if routine.archived_at is not null then
    raise exception 'archived routines cannot be edited' using errcode = '55000';
  end if;

  next_schedule_kind := coalesce(p_schedule_kind, routine.schedule_kind);
  next_schedule_rule := coalesce(p_schedule_rule, routine.schedule_rule);
  if not private.is_valid_routine_schedule(next_schedule_kind, next_schedule_rule) then
    raise exception 'invalid schedule rule for schedule kind %', next_schedule_kind
      using errcode = '22023';
  end if;

  next_assignment_policy := coalesce(p_assignment_policy, routine.assignment_policy);
  if p_assignment_policy is null then
    next_assigned := coalesce(p_assigned_member_id, routine.assigned_member_id);
    next_rotation := coalesce(p_rotation_anchor_member_id, routine.rotation_anchor_member_id);
  else
    next_assigned := p_assigned_member_id;
    next_rotation := p_rotation_anchor_member_id;
  end if;

  case next_assignment_policy
    when 'assigned' then
      if next_assigned is null or next_rotation is not null then
        raise exception 'assigned routines require only assigned_member_id'
          using errcode = '22023';
      end if;
    when 'alternating' then
      if next_assigned is not null or next_rotation is null then
        raise exception 'alternating routines require only rotation_anchor_member_id'
          using errcode = '22023';
      end if;
    when 'shared' then
      if next_assigned is not null or next_rotation is not null then
        raise exception 'shared routines cannot name an assignee'
          using errcode = '22023';
      end if;
    else
      raise exception 'unknown assignment policy %', next_assignment_policy
        using errcode = '22023';
  end case;

  update public.routines
  set
    title = coalesce(nullif(trim(p_title), ''), title),
    instructions = case when p_instructions is null then instructions else p_instructions end,
    area_id = coalesce(p_area_id, area_id),
    pet_id = case when p_pet_id is null and p_area_id is null then pet_id else p_pet_id end,
    assignment_policy = next_assignment_policy,
    assigned_member_id = next_assigned,
    rotation_anchor_member_id = next_rotation,
    schedule_kind = next_schedule_kind,
    schedule_rule = next_schedule_rule,
    priority = coalesce(p_priority, priority),
    active_from = case when p_active_from is null and p_active_until is null then active_from else p_active_from end,
    active_until = case when p_active_from is null and p_active_until is null then active_until else p_active_until end,
    updated_at = now()
  where id = p_routine_id
  returning * into routine;

  if p_rebuild_window
    and (
      p_schedule_kind is not null
      or p_schedule_rule is not null
      or p_assignment_policy is not null
      or p_assigned_member_id is not null
      or p_rotation_anchor_member_id is not null
      or p_active_from is not null
      or p_active_until is not null
    )
  then
    for open_row in
      select *
      from public.routine_occurrences
      where routine_id = p_routine_id
        and status = 'open'
      for update
    loop
      update public.reminder_candidates
      set status = 'cancelled'
      where occurrence_id = open_row.id
        and status = 'pending';
      delete from public.routine_occurrences where id = open_row.id;
    end loop;

    first_due := private.first_routine_due_date(
      routine.schedule_rule,
      greatest(private.household_today(), coalesce(routine.active_from, private.household_today()))
    );
    perform private.ensure_routine_window(routine.id, first_due, null);
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
    'routine_updated',
    'routine',
    routine.id,
    jsonb_build_object(
      'schedule_kind', routine.schedule_kind,
      'assignment_policy', routine.assignment_policy
    )
  );

  return jsonb_build_object('routine_id', routine.id);
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
    and (
      routine.active_from is null
      or occurrence.due_date >= routine.active_from
    )
    and (
      routine.active_until is null
      or occurrence.due_date <= routine.active_until
    );

  if p_command_kind = 'reschedule' then
    if p_new_due_date is null or p_new_due_date = occurrence.due_date then
      raise exception 'reschedule date must differ from the current due date'
        using errcode = '22023';
    end if;

    update public.routine_occurrences
    set due_date = p_new_due_date,
        rescheduled_at = now()
    where id = occurrence.id;

    update public.reminder_candidates
    set status = 'cancelled'
    where occurrence_id = occurrence.id
      and status = 'pending';
    perform private.create_reminder_candidates_for_occurrence(occurrence.id);

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

create policy "members can read command receipts"
on public.routine_command_receipts for select to authenticated
using ((select private.is_household_member(household_id)));

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
grant select on table public.routine_command_receipts to authenticated;
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

revoke all on function private.household_today() from public, anon, authenticated;
revoke execute on function public.create_routine(
  uuid, text, uuid, text, text, jsonb, uuid, uuid, text, uuid, text, date, date
) from public, anon;
revoke execute on function public.update_routine_definition(
  uuid, text, text, uuid, uuid, text, uuid, uuid, text, jsonb, text, date, date, boolean
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
grant execute on function public.update_routine_definition(
  uuid, text, text, uuid, uuid, text, uuid, uuid, text, jsonb, text, date, date, boolean
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
