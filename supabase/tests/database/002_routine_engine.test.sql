begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

select has_table('public', 'areas', 'areas table exists');
select has_table('public', 'pets', 'pets table exists');
select has_table('public', 'routines', 'routines table exists');
select has_table(
  'public',
  'routine_occurrences',
  'routine_occurrences table exists'
);
select has_table(
  'public',
  'routine_completions',
  'routine_completions table exists'
);
select has_table(
  'public',
  'activity_events',
  'activity_events table exists'
);
select has_table(
  'public',
  'reminder_candidates',
  'reminder_candidates table exists'
);
select has_function(
  'public',
  'complete_occurrence',
  array['uuid', 'text', 'date', 'text', 'text'],
  'complete_occurrence function exists'
);
select has_function(
  'public',
  'skip_occurrence',
  array['uuid', 'text'],
  'skip_occurrence function exists'
);
select has_function(
  'public',
  'reschedule_occurrence',
  array['uuid', 'date', 'text'],
  'reschedule_occurrence function exists'
);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000001', 'member-one@example.invalid'),
  ('00000000-0000-4000-8000-000000000002', 'member-two@example.invalid'),
  ('00000000-0000-4000-8000-000000000003', 'other-one@example.invalid'),
  ('00000000-0000-4000-8000-000000000004', 'other-two@example.invalid'),
  ('00000000-0000-4000-8000-000000000005', 'outsider@example.invalid');

insert into public.households (id, name)
values
  ('10000000-0000-4000-8000-000000000001', 'First household'),
  ('10000000-0000-4000-8000-000000000002', 'Second household');

insert into public.household_members (household_id, user_id, display_name)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'Member One'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    'Member Two'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
    'Other One'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000004',
    'Other Two'
  );

select results_eq(
  $$
    select name
    from public.areas
    where household_id = '10000000-0000-4000-8000-000000000001'
    order by sort_order
  $$,
  $$
    values
      ('Cleaning'::text),
      ('Kitchen'::text),
      ('Laundry'::text),
      ('Dog'::text),
      ('Meals'::text),
      ('General'::text)
  $$,
  'new households receive the six default areas'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select results_eq(
  $$ select distinct household_id from public.areas order by household_id $$,
  $$ values ('10000000-0000-4000-8000-000000000001'::uuid) $$,
  'RLS hides areas owned by another household'
);

select lives_ok(
  $sql$
    select public.create_routine(
      p_household_id => '10000000-0000-4000-8000-000000000001',
      p_title => 'Wipe counters',
      p_area_id => (
        select id from public.areas where name = 'Kitchen'
      ),
      p_assignment_policy => 'alternating',
      p_schedule_kind => 'calendar',
      p_schedule_rule => '{"kind":"daily"}'::jsonb,
      p_priority => 'cleaning',
      p_rotation_anchor_member_id => '00000000-0000-4000-8000-000000000001',
      p_first_due_on => '2026-08-09'
    )
  $sql$,
  'a member can create a daily alternating routine'
);
select results_eq(
  $$
    select
      occurrence.role,
      occurrence.due_date,
      occurrence.planned_assignee_id
    from public.routine_occurrences as occurrence
    join public.routines as routine on routine.id = occurrence.routine_id
    where routine.title = 'Wipe counters'
      and occurrence.status = 'open'
    order by case occurrence.role when 'current' then 1 else 2 end
  $$,
  $$
    values
      (
        'current'::text,
        '2026-08-09'::date,
        '00000000-0000-4000-8000-000000000001'::uuid
      ),
      (
        'preview'::text,
        '2026-08-10'::date,
        '00000000-0000-4000-8000-000000000002'::uuid
      )
  $$,
  'a new alternating routine has one current and one preview occurrence'
);
select lives_ok(
  $sql$
    insert into public.routine_reminder_preferences (
      routine_id,
      member_id,
      household_id,
      enabled,
      due_day_local_time
    )
    select
      id,
      '00000000-0000-4000-8000-000000000001',
      household_id,
      true,
      '08:00'
    from public.routines
    where title = 'Wipe counters'
  $sql$,
  'a member can enable a reminder preference'
);
select lives_ok(
  $sql$
    select public.complete_occurrence(
      (
        select occurrence.id
        from public.routine_occurrences as occurrence
        join public.routines as routine on routine.id = occurrence.routine_id
        where routine.title = 'Wipe counters'
          and occurrence.role = 'current'
      ),
      'complete-daily-1',
      '2026-08-09'
    )
  $sql$,
  'the current daily occurrence can be completed'
);
select is(
  (
    select count(*)
    from public.routine_completions as completion
    join public.routine_occurrences as occurrence
      on occurrence.id = completion.occurrence_id
    join public.routines as routine on routine.id = occurrence.routine_id
    where routine.title = 'Wipe counters'
  ),
  1::bigint,
  'completion history retains one daily completion'
);
select results_eq(
  $$
    select occurrence.due_date, occurrence.planned_assignee_id
    from public.routine_occurrences as occurrence
    join public.routines as routine on routine.id = occurrence.routine_id
    where routine.title = 'Wipe counters'
      and occurrence.status = 'open'
      and occurrence.role = 'current'
  $$,
  $$
    values (
      '2026-08-10'::date,
      '00000000-0000-4000-8000-000000000002'::uuid
    )
  $$,
  'completion advances the daily current occurrence and alternates assignment'
);
select ok(
  exists (
    select 1
    from public.activity_events as activity
    join public.routine_occurrences as occurrence
      on occurrence.id = activity.entity_id
    join public.routines as routine on routine.id = occurrence.routine_id
    where routine.title = 'Wipe counters'
      and activity.kind = 'occurrence_completed'
  ),
  'completion writes an occurrence_completed activity event'
);
select results_eq(
  $$
    select
      candidate.member_id,
      candidate.remind_on,
      candidate.remind_local_time,
      candidate.status
    from public.reminder_candidates as candidate
    join public.routine_occurrences as occurrence
      on occurrence.id = candidate.occurrence_id
    join public.routines as routine on routine.id = occurrence.routine_id
    where routine.title = 'Wipe counters'
      and candidate.status = 'pending'
  $$,
  $$
    values (
      '00000000-0000-4000-8000-000000000001'::uuid,
      '2026-08-11'::date,
      '08:00'::time,
      'pending'::text
    )
  $$,
  'enabled preferences create a reminder candidate for the new preview'
);
select lives_ok(
  $sql$
    select public.complete_occurrence(
      (
        select occurrence.id
        from public.routine_occurrences as occurrence
        join public.routines as routine on routine.id = occurrence.routine_id
        where routine.title = 'Wipe counters'
          and occurrence.status = 'completed'
      ),
      'complete-daily-1',
      '2026-08-09'
    )
  $sql$,
  'repeating a completion idempotency key succeeds'
);
select is(
  (
    select count(*)
    from public.routine_completions as completion
    join public.routine_occurrences as occurrence
      on occurrence.id = completion.occurrence_id
    join public.routines as routine on routine.id = occurrence.routine_id
    where routine.title = 'Wipe counters'
  ),
  1::bigint,
  'repeating a completion idempotency key keeps one completion'
);

select lives_ok(
  $sql$
    select public.create_routine(
      p_household_id => '10000000-0000-4000-8000-000000000001',
      p_title => 'Brush dog',
      p_area_id => (
        select id from public.areas where name = 'Dog'
      ),
      p_assignment_policy => 'assigned',
      p_schedule_kind => 'after_completion',
      p_schedule_rule => '{"kind":"after_completion","every":3,"unit":"days"}'::jsonb,
      p_priority => 'pet_care',
      p_assigned_member_id => '00000000-0000-4000-8000-000000000002',
      p_first_due_on => '2026-08-01'
    )
  $sql$,
  'a member can create an assigned completion-based routine'
);
select lives_ok(
  $sql$
    select public.complete_occurrence(
      (
        select occurrence.id
        from public.routine_occurrences as occurrence
        join public.routines as routine on routine.id = occurrence.routine_id
        where routine.title = 'Brush dog'
          and occurrence.role = 'current'
      ),
      'complete-brush-dog-1',
      '2026-08-05'
    )
  $sql$,
  'the completion-based routine can be completed on its actual completion date'
);
select results_eq(
  $$
    select occurrence.due_date, occurrence.planned_assignee_id
    from public.routine_occurrences as occurrence
    join public.routines as routine on routine.id = occurrence.routine_id
    where routine.title = 'Brush dog'
      and occurrence.status = 'open'
      and occurrence.role = 'current'
  $$,
  $$
    values (
      '2026-08-08'::date,
      '00000000-0000-4000-8000-000000000002'::uuid
    )
  $$,
  'completion-based recurrence anchors the next due date to completion'
);

select lives_ok(
  $sql$
    select public.create_routine(
      p_household_id => '10000000-0000-4000-8000-000000000001',
      p_title => 'Take bins out',
      p_area_id => (
        select id from public.areas where name = 'General'
      ),
      p_assignment_policy => 'shared',
      p_schedule_kind => 'calendar',
      p_schedule_rule => '{"kind":"daily"}'::jsonb,
      p_priority => 'general',
      p_first_due_on => '2026-08-09'
    )
  $sql$,
  'a member can create a shared daily routine'
);
select lives_ok(
  $sql$
    select public.skip_occurrence(
      (
        select occurrence.id
        from public.routine_occurrences as occurrence
        join public.routines as routine on routine.id = occurrence.routine_id
        where routine.title = 'Take bins out'
          and occurrence.role = 'current'
      ),
      'skip-bins-1'
    )
  $sql$,
  'the current shared occurrence can be skipped'
);
select is(
  (
    select count(*)
    from public.routine_completions as completion
    join public.routine_occurrences as occurrence
      on occurrence.id = completion.occurrence_id
    join public.routines as routine on routine.id = occurrence.routine_id
    where routine.title = 'Take bins out'
  ),
  0::bigint,
  'skipping creates no completion'
);
select results_eq(
  $$
    select occurrence.due_date
    from public.routine_occurrences as occurrence
    join public.routines as routine on routine.id = occurrence.routine_id
    where routine.title = 'Take bins out'
      and occurrence.status = 'open'
      and occurrence.role = 'current'
  $$,
  $$ values ('2026-08-10'::date) $$,
  'skipping preserves the daily cadence'
);
select lives_ok(
  $sql$
    select public.reschedule_occurrence(
      (
        select occurrence.id
        from public.routine_occurrences as occurrence
        join public.routines as routine on routine.id = occurrence.routine_id
        where routine.title = 'Take bins out'
          and occurrence.role = 'current'
      ),
      '2026-08-12',
      'reschedule-bins-1'
    )
  $sql$,
  'the next shared occurrence can be rescheduled'
);
select results_eq(
  $$
    select
      occurrence.due_date,
      occurrence.original_due_date,
      occurrence.rescheduled_at is not null
    from public.routine_occurrences as occurrence
    join public.routines as routine on routine.id = occurrence.routine_id
    where routine.title = 'Take bins out'
      and occurrence.status = 'open'
      and occurrence.role = 'current'
  $$,
  $$ values ('2026-08-12'::date, '2026-08-10'::date, true) $$,
  'rescheduling changes the due date while retaining the original date'
);
select lives_ok(
  $sql$
    select public.archive_routine(
      (select id from public.routines where title = 'Take bins out')
    )
  $sql$,
  'the shared routine can be archived'
);
select ok(
  (
    select archived_at is not null
    from public.routines
    where title = 'Take bins out'
  ),
  'archiving marks the routine as archived'
);
select is(
  (
    select count(*)
    from public.routine_occurrences as occurrence
    join public.routines as routine on routine.id = occurrence.routine_id
    where routine.title = 'Take bins out'
      and occurrence.status = 'skipped'
  ),
  1::bigint,
  'archiving preserves skipped occurrence history'
);
select is(
  (
    select count(*)
    from public.routine_occurrences as occurrence
    join public.routines as routine on routine.id = occurrence.routine_id
    where routine.title = 'Take bins out'
      and occurrence.role = 'preview'
  ),
  0::bigint,
  'archiving discards the preview occurrence'
);

reset role;

select * from finish();
rollback;
