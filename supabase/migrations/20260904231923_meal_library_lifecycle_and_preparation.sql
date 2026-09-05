-- Meal library changes are visible to both members and retained for recovery.
alter table public.meal_grocery_templates add column archived_at timestamptz;
grant update (archived_at) on public.meal_grocery_templates to authenticated;
revoke delete on public.meal_grocery_templates from authenticated;
drop policy if exists "members can delete meal grocery templates" on public.meal_grocery_templates;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meal_definitions') then
    alter publication supabase_realtime add table public.meal_definitions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meal_grocery_templates') then
    alter publication supabase_realtime add table public.meal_grocery_templates;
  end if;
end;
$$;

create or replace function private.materialize_meal_groceries(
  p_meal_plan_entry_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry public.meal_plan_entries%rowtype;
  created_count integer;
begin
  select stored_entry.*
  into entry
  from public.meal_plan_entries as stored_entry
  where stored_entry.id = p_meal_plan_entry_id
  for update;

  if not found then
    raise exception 'meal-plan entry % does not exist', p_meal_plan_entry_id
      using errcode = 'P0002';
  end if;
  if entry.slot is null
    or entry.meal_definition_id is null
    or entry.leftover_of_entry_id is not null
    or entry.groceries_materialized_at is not null
  then
    return 0;
  end if;

  insert into public.grocery_items (
    household_id,
    name,
    quantity,
    unit,
    category_id,
    note,
    originating_meal_plan_entry_id,
    sort_order
  )
  select
    template.household_id,
    template.name,
    template.quantity,
    template.unit,
    template.grocery_category_id,
    template.note,
    entry.id,
    template.sort_order
  from public.meal_grocery_templates as template
  where template.household_id = entry.household_id
    and template.meal_definition_id = entry.meal_definition_id
    and template.archived_at is null
  order by template.sort_order, template.id;

  get diagnostics created_count = row_count;

  update public.meal_plan_entries
  set groceries_materialized_at = now()
  where id = entry.id;

  return created_count;
end;
$$;

create or replace function public.save_planned_meal_to_library(
  p_entry_id uuid, p_definition_id uuid, p_name text,
  p_recipe_url text default null, p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  entry public.meal_plan_entries%rowtype;
begin
  select * into entry from public.meal_plan_entries where id = p_entry_id;
  if not found then raise exception 'Meal is no longer available.' using errcode = 'P0002'; end if;
  if auth.uid() is null or not private.is_household_member(entry.household_id) then
    raise exception 'Not a member of this household.' using errcode = '42501';
  end if;
  select * into entry from public.meal_plan_entries where id = p_entry_id for update;
  -- The source link is the durable retry record, including competing save forms.
  if entry.meal_definition_id is not null then
    return jsonb_build_object('meal_definition_id', entry.meal_definition_id);
  end if;
  if entry.removed_at is not null then raise exception 'Removed meals cannot be saved.' using errcode = '55000'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120
    or (p_recipe_url is not null and (p_recipe_url !~* '^https?://' or length(p_recipe_url) > 2000))
    or length(p_notes) > 4000 then
    raise exception 'Check the meal name, recipe link and notes.' using errcode = '22023';
  end if;
  insert into public.meal_definitions (id, household_id, name, recipe_url, notes)
  values (p_definition_id, entry.household_id, trim(p_name), p_recipe_url, p_notes);
  update public.meal_plan_entries set
    meal_definition_id = p_definition_id,
    groceries_materialized_at = case when slot is not null then coalesce(groceries_materialized_at, now()) else groceries_materialized_at end
  where id = entry.id;
  return jsonb_build_object('meal_definition_id', p_definition_id);
end;
$$;
revoke all on function public.save_planned_meal_to_library(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.save_planned_meal_to_library(uuid, uuid, text, text, text) to authenticated;

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
  linked_prep public.routine_occurrences%rowtype;
  next_schedule_kind text;
  next_schedule_rule jsonb;
  next_assignment_policy text;
  next_assigned uuid;
  next_rotation uuid;
  open_row public.routine_occurrences%rowtype;
  first_due date;
  window_due_date date;
  window_anchor date;
  window_rescheduled_at timestamptz;
  window_assignee_id uuid;
  assignment_unchanged boolean;
  affect_member_ids uuid[] := array[]::uuid[];
  schedule_or_assignment_changed boolean := false;
  activity_payload jsonb;
  activity_event_id uuid;
begin
  select * into routine from public.routines where id = p_routine_id;
  if routine.id is null then
    raise exception 'routine % does not exist', p_routine_id using errcode = 'P0002';
  end if;
  if actor_member_id is null or not private.is_household_member(routine.household_id) then
    raise exception 'caller is not a member of household %', routine.household_id using errcode = '42501';
  end if;
  -- Closure and removal also lock the occurrence before its routine.
  select * into linked_prep from public.routine_occurrences
  where routine_id = p_routine_id and meal_plan_entry_id is not null for update;
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

  select * into linked_prep from public.routine_occurrences
  where routine_id = p_routine_id and meal_plan_entry_id is not null;
  if linked_prep.id is not null and next_schedule_kind <> 'one_off' then
    raise exception 'Meal preparation must remain a one-off task.' using errcode = '22023';
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

  if linked_prep.id is not null and linked_prep.status <> 'open' and (
    next_schedule_rule is distinct from routine.schedule_rule
    or next_assignment_policy is distinct from routine.assignment_policy
    or next_assigned is distinct from routine.assigned_member_id
    or next_rotation is distinct from routine.rotation_anchor_member_id
  ) then
    raise exception 'Finished meal preparation keeps its date and assignee. You can still edit its title and instructions.'
      using errcode = '55000';
  end if;

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
    active_from = case when linked_prep.id is not null then (next_schedule_rule ->> 'date')::date when p_active_from is null and p_active_until is null then active_from else p_active_from end,
    active_until = case when linked_prep.id is not null then (next_schedule_rule ->> 'date')::date when p_active_from is null and p_active_until is null then active_until else p_active_until end,
    updated_at = now()
  where id = p_routine_id
  returning * into routine;

  if linked_prep.id is not null then
    -- A prep is one durable occurrence. Rebuilding it would sever the meal link
    -- and could manufacture a second task after a completion or a meal removal.
    if linked_prep.status = 'open' then
      update public.routine_occurrences set
        due_date = case when previous_routine.schedule_rule = routine.schedule_rule
          then due_date else (routine.schedule_rule ->> 'date')::date end,
        original_due_date = case when previous_routine.schedule_rule = routine.schedule_rule
          then original_due_date else (routine.schedule_rule ->> 'date')::date end,
        rescheduled_at = case when previous_routine.schedule_rule = routine.schedule_rule
          then rescheduled_at else null end,
        planned_assignee_id = case
          when previous_routine.assignment_policy = routine.assignment_policy
            and previous_routine.assigned_member_id is not distinct from routine.assigned_member_id
            and previous_routine.rotation_anchor_member_id is not distinct from routine.rotation_anchor_member_id
          then planned_assignee_id
          when routine.assignment_policy = 'assigned' then routine.assigned_member_id
          when routine.assignment_policy = 'alternating' then routine.rotation_anchor_member_id
          else null end
      where id = linked_prep.id and status = 'open';
      if previous_routine.schedule_rule is distinct from routine.schedule_rule
        or previous_routine.assignment_policy is distinct from routine.assignment_policy
        or previous_routine.assigned_member_id is distinct from routine.assigned_member_id
        or previous_routine.rotation_anchor_member_id is distinct from routine.rotation_anchor_member_id
      then
        perform private.cancel_inbox_reminder_for_occurrence(linked_prep.id);
        update public.reminder_candidates set status = 'cancelled'
        where occurrence_id = linked_prep.id and status = 'pending';
        perform private.create_reminder_candidates_for_occurrence(linked_prep.id);
      end if;
    end if;
  elsif p_rebuild_window
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
    select
      occurrence.due_date,
      occurrence.original_due_date,
      occurrence.rescheduled_at,
      occurrence.planned_assignee_id
    into window_due_date, window_anchor, window_rescheduled_at, window_assignee_id
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
      and (routine.active_until is null or window_due_date <= routine.active_until)
    then
      -- The schedule rule is unchanged, so recreate the current occurrence
      -- exactly as it was: the due date keeps any reschedule, the original
      -- due date keeps the recurrence anchor the preview follows, and the
      -- reschedule timestamp survives. A preserved date pushed outside the
      -- new active window falls through to re-anchoring instead. When no
      -- assignment field changed either, the planned assignee carries over
      -- so an alternating rotation does not restart at its anchor.
      assignment_unchanged :=
        previous_routine.assignment_policy is not distinct from routine.assignment_policy
        and previous_routine.assigned_member_id is not distinct from routine.assigned_member_id
        and previous_routine.rotation_anchor_member_id
          is not distinct from routine.rotation_anchor_member_id;
      perform private.ensure_routine_window(
        routine.id,
        window_due_date,
        null,
        window_anchor,
        window_rescheduled_at,
        case when assignment_unchanged then window_assignee_id end
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
