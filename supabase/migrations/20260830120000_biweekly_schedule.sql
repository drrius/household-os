-- Add the biweekly calendar schedule rule: every two weeks on one ISO weekday.
-- The rule anchors on the first matching weekday. Succession anchors on the
-- closed occurrence's original due date, so a reschedule moves only that
-- occurrence (ADR 0014) and an on-cadence closure yields exactly fourteen
-- days. Mirrors src/domain/routines/schedule.ts.

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
    when 'weekly', 'biweekly' then
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
    when 'weekly', 'biweekly' then
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

-- Biweekly phase is invisible in the weekday alone, so succession needs the
-- closed occurrence's pre-reschedule anchor. Replace the three-argument
-- signature rather than overloading it: a default fourth argument alongside
-- the old signature would make three-argument calls ambiguous. Guarded so the
-- migration stays idempotent if it is ever re-applied.
drop function if exists private.next_routine_due_date(jsonb, date, date);

create or replace function private.next_routine_due_date(
  p_schedule_rule jsonb,
  p_closed_due_date date,
  p_completed_on date default null,
  p_original_due_date date default null
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
    when 'biweekly' then
      anchor_date := coalesce(p_original_due_date, p_closed_due_date);
      return private.first_routine_due_date(p_schedule_rule, anchor_date + 8);
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

revoke all on function private.next_routine_due_date(jsonb, date, date, date)
from public, anon, authenticated;

-- Rebuild anchor for update_routine_definition: when the schedule rule itself
-- is unchanged and biweekly, keep the open window's two-week phase instead of
-- re-anchoring on the rebuild day, so an assignment-only edit does not shift
-- future occurrences (ADR 0014).
create or replace function private.first_rebuild_due_date(
  p_schedule_rule jsonb,
  p_previous_rule jsonb,
  p_window_anchor date,
  p_from_inclusive date
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_schedule_rule ->> 'kind' <> 'biweekly'
    or p_window_anchor is null
    or p_previous_rule is null
    or p_schedule_rule <> p_previous_rule
  then
    return private.first_routine_due_date(p_schedule_rule, p_from_inclusive);
  end if;

  if p_from_inclusive <= p_window_anchor then
    return p_window_anchor;
  end if;

  return p_window_anchor
    + ((((p_from_inclusive - p_window_anchor) + 13) / 14) * 14);
end;
$$;

revoke all on function private.first_rebuild_due_date(jsonb, jsonb, date, date)
from public, anon, authenticated;

-- Callers that close or regenerate occurrences pass the original due date so
-- biweekly succession survives reschedules. ensure_routine_window is based on
-- 20260809210000_routine_engine.sql; apply_routine_closure and
-- update_routine_definition are based on their latest replacements in
-- 20260812090000_notifications_realtime.sql. A future replacement of any of
-- them must start from the newest definition.
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
      null,
      current_occurrence.original_due_date
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
        latest_completed_on,
        latest_occurrence.original_due_date
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
  activity_payload jsonb;
  activity_event_id uuid;
  notice_member_ids uuid[] := array[]::uuid[];
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
    perform private.cancel_inbox_reminder_for_occurrence(occurrence.id);
    perform private.create_reminder_candidates_for_occurrence(occurrence.id);

    activity_payload := jsonb_build_object(
      'routine_id', routine.id,
      'from_due_date', occurrence.due_date,
      'to_due_date', p_new_due_date
    );
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
      activity_payload
    )
    returning id into activity_event_id;

    if occurrence.planned_assignee_id is null then
      select coalesce(
        array_agg(member.user_id order by member.user_id),
        '{}'::uuid[]
      )
      into notice_member_ids
      from public.household_members as member
      where member.household_id = routine.household_id;
    else
      notice_member_ids := array[occurrence.planned_assignee_id];
    end if;

    perform private.deliver_partner_notice(
      routine.household_id,
      actor_member_id,
      'occurrence_rescheduled',
      'routine_occurrence',
      occurrence.id,
      activity_payload,
      activity_event_id,
      notice_member_ids
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

    perform private.cancel_inbox_reminder_for_occurrence(occurrence.id);

    if routine_active then
      first_due_date := private.next_routine_due_date(
        routine.schedule_rule,
        occurrence.due_date,
        case when p_command_kind = 'complete' then p_completed_on else null end,
        occurrence.original_due_date
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
        null,
        preview.original_due_date
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
  previous_routine public.routines%rowtype;
  next_schedule_kind text;
  next_schedule_rule jsonb;
  next_assignment_policy text;
  next_assigned uuid;
  next_rotation uuid;
  open_row public.routine_occurrences%rowtype;
  first_due date;
  window_anchor date;
  affect_member_ids uuid[] := array[]::uuid[];
  schedule_or_assignment_changed boolean := false;
  activity_payload jsonb;
  activity_event_id uuid;
begin
  select * into routine from public.routines where id = p_routine_id for update;
  previous_routine := routine;
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
    select occurrence.original_due_date
    into window_anchor
    from public.routine_occurrences as occurrence
    where occurrence.routine_id = p_routine_id
      and occurrence.status = 'open'
      and occurrence.role = 'current';

    for open_row in
      select *
      from public.routine_occurrences
      where routine_id = p_routine_id
        and status = 'open'
      for update
    loop
      perform private.cancel_inbox_reminder_for_occurrence(open_row.id);
      update public.reminder_candidates
      set status = 'cancelled'
      where occurrence_id = open_row.id
        and status = 'pending';
      delete from public.routine_occurrences where id = open_row.id;
    end loop;

    first_due := private.first_rebuild_due_date(
      routine.schedule_rule,
      previous_routine.schedule_rule,
      window_anchor,
      greatest(private.household_today(), coalesce(routine.active_from, private.household_today()))
    );
    perform private.ensure_routine_window(routine.id, first_due, null);
  end if;

  schedule_or_assignment_changed :=
    previous_routine.schedule_kind is distinct from routine.schedule_kind
    or previous_routine.schedule_rule is distinct from routine.schedule_rule
    or previous_routine.assignment_policy is distinct from routine.assignment_policy
    or previous_routine.assigned_member_id is distinct from routine.assigned_member_id
    or previous_routine.rotation_anchor_member_id is distinct from routine.rotation_anchor_member_id
    or previous_routine.active_from is distinct from routine.active_from
    or previous_routine.active_until is distinct from routine.active_until;

  if schedule_or_assignment_changed then
    affect_member_ids := private.affected_members_for_routine_change(
      previous_routine.assigned_member_id,
      previous_routine.assignment_policy,
      routine.assigned_member_id,
      routine.assignment_policy,
      routine.household_id
    );
  end if;

  activity_payload := jsonb_build_object(
    'schedule_kind', routine.schedule_kind,
    'assignment_policy', routine.assignment_policy,
    'affect_member_ids', to_jsonb(affect_member_ids)
  );
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
    activity_payload
  )
  returning id into activity_event_id;

  if schedule_or_assignment_changed then
    perform private.deliver_partner_notice(
      routine.household_id,
      actor_member_id,
      'routine_updated',
      'routine',
      routine.id,
      activity_payload,
      activity_event_id,
      affect_member_ids
    );
  end if;

  return jsonb_build_object('routine_id', routine.id);
end;
$$;
