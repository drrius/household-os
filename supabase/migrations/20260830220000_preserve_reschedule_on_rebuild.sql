-- Preserve reschedules through open-window rebuilds.
--
-- update_routine_definition rebuilds the open occurrence window by deleting
-- and recreating it, and until now always re-derived the current occurrence's
-- due date from today's calendar grid. That silently discarded a reschedule
-- (due_date <> original_due_date) on every schedule kind, even for edits that
-- did not touch the schedule at all. When the schedule rule is unchanged, the
-- rebuild now recreates the current occurrence with both its previous
-- due_date (keeping the reschedule) and its previous original_due_date
-- (keeping the recurrence anchor that biweekly succession and
-- first_rebuild_due_date phase on). A changed schedule rule keeps the
-- re-anchoring behavior. See ADR 0026.
--
-- insert_open_routine_occurrence is based on its definition in
-- 20260809210000_routine_engine.sql; ensure_routine_window and
-- update_routine_definition are based on their latest replacements in
-- 20260830210000_biweekly_schedule.sql. A future replacement of any of them
-- must start from the newest definition.

-- The rebuild deletes open occurrences, but a rescheduled current occurrence
-- is referenced by its reschedule command receipt, so the delete violated the
-- receipts foreign key and the whole edit failed. Receipts are the
-- idempotency ledger and must outlive the occurrence they acted on: unlink
-- them instead of blocking the delete.
alter table public.routine_command_receipts
  alter column occurrence_id drop not null;

alter table public.routine_command_receipts
  drop constraint routine_command_receipts_household_id_occurrence_id_fkey;

alter table public.routine_command_receipts
  add constraint routine_command_receipts_household_id_occurrence_id_fkey
    foreign key (household_id, occurrence_id)
    references public.routine_occurrences (household_id, id)
    on delete set null (occurrence_id);

-- A defaulted fifth parameter alongside the old signature would make existing
-- four-argument calls ambiguous, so replace the signature. Guarded so the
-- migration stays idempotent if it is ever re-applied.
drop function if exists private.insert_open_routine_occurrence(
  public.routines, text, date, uuid
);

create or replace function private.insert_open_routine_occurrence(
  p_routine public.routines,
  p_role text,
  p_due_date date,
  p_previous_planned_assignee_id uuid,
  p_original_due_date date default null
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
    coalesce(p_original_due_date, p_due_date),
    planned_assignee_id,
    'open',
    p_role
  )
  returning id into occurrence_id;

  perform private.create_reminder_candidates_for_occurrence(occurrence_id);
  return occurrence_id;
end;
$$;

revoke all on function private.insert_open_routine_occurrence(
  public.routines, text, date, uuid, date
) from public, anon, authenticated;

drop function if exists private.ensure_routine_window(uuid, date, uuid);

create or replace function private.ensure_routine_window(
  p_routine_id uuid,
  p_first_due_date date default null,
  p_previous_planned_assignee_id uuid default null,
  p_first_original_due_date date default null
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
  -- The caller-supplied anchor only makes sense for the caller-supplied due
  -- date, never for one derived from history below.
  first_original_due_date date := case
    when p_first_due_date is not null then p_first_original_due_date
  end;
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
    previous_assignee_id,
    first_original_due_date
  );

  select occurrence.*
  into current_occurrence
  from public.routine_occurrences as occurrence
  where occurrence.id = current_occurrence_id;

  second_due_date := private.next_routine_due_date(
    routine.schedule_rule,
    first_due_date,
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
end;
$$;

revoke all on function private.ensure_routine_window(uuid, date, uuid, date)
from public, anon, authenticated;

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
  window_due_date date;
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
    select occurrence.due_date, occurrence.original_due_date
    into window_due_date, window_anchor
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

    if window_due_date is not null
      and routine.schedule_kind = previous_routine.schedule_kind
      and routine.schedule_rule = previous_routine.schedule_rule
      and (routine.active_from is null or window_due_date >= routine.active_from)
    then
      -- The schedule rule is unchanged, so recreate the current occurrence
      -- exactly as it was: the due date keeps any reschedule and the original
      -- due date keeps the recurrence anchor the preview follows.
      perform private.ensure_routine_window(
        routine.id,
        window_due_date,
        null,
        window_anchor
      );
    else
      first_due := private.first_rebuild_due_date(
        routine.schedule_rule,
        previous_routine.schedule_rule,
        window_anchor,
        greatest(private.household_today(), coalesce(routine.active_from, private.household_today()))
      );
      perform private.ensure_routine_window(routine.id, first_due, null);
    end if;
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
