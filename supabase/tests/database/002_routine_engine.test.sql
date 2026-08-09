begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

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
  'routine_command_receipts',
  'routine_command_receipts table exists'
);
select has_table('public', 'activity_events', 'activity_events table exists');
select has_table(
  'public',
  'routine_reminder_preferences',
  'routine_reminder_preferences table exists'
);
select has_table(
  'public',
  'reminder_candidates',
  'reminder_candidates table exists'
);

select has_function('public', 'create_routine', 'create_routine exists');
select has_function(
  'public',
  'complete_occurrence',
  'complete_occurrence exists'
);
select has_function('public', 'skip_occurrence', 'skip_occurrence exists');
select has_function(
  'public',
  'reschedule_occurrence',
  'reschedule_occurrence exists'
);
select has_function('public', 'pause_routine', 'pause_routine exists');
select has_function('public', 'unpause_routine', 'unpause_routine exists');
select has_function('public', 'archive_routine', 'archive_routine exists');

select ok(
  (
    select count(*) = 9 and bool_and(relrowsecurity)
    from pg_class
    where oid in (
      'public.areas'::regclass,
      'public.pets'::regclass,
      'public.routines'::regclass,
      'public.routine_occurrences'::regclass,
      'public.routine_completions'::regclass,
      'public.routine_command_receipts'::regclass,
      'public.activity_events'::regclass,
      'public.routine_reminder_preferences'::regclass,
      'public.reminder_candidates'::regclass
    )
  ),
  'RLS is enabled on every routine-engine table'
);

select ok(
  (
    select count(distinct tablename) = 8
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'areas',
        'pets',
        'routines',
        'routine_occurrences',
        'routine_completions',
        'activity_events',
        'routine_reminder_preferences',
        'reminder_candidates'
      )
  ),
  'every client-readable routine table has an RLS policy'
);

select col_is_pk(
  'public',
  'routine_command_receipts',
  array['household_id', 'idempotency_key'],
  'command receipts serialize one result per household key'
);

select ok(
  not has_table_privilege('anon', 'public.areas', 'select'),
  'anonymous clients cannot read areas'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.complete_occurrence(uuid,text,date,text,text)',
    'execute'
  ),
  'anonymous clients cannot execute completion commands'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.routine_completions',
    'insert'
  ),
  'authenticated clients cannot insert completions directly'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.routine_command_receipts',
    'insert'
  ),
  'authenticated clients cannot insert command receipts directly'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.routine_occurrences',
    'update'
  ),
  'authenticated clients cannot update occurrence state directly'
);
select ok(
  has_table_privilege('authenticated', 'public.areas', 'insert'),
  'authenticated clients may create areas under RLS'
);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000011', 'routine-member-one@example.invalid'),
  ('00000000-0000-4000-8000-000000000012', 'routine-member-two@example.invalid'),
  ('00000000-0000-4000-8000-000000000013', 'routine-other-one@example.invalid'),
  ('00000000-0000-4000-8000-000000000014', 'routine-other-two@example.invalid'),
  ('00000000-0000-4000-8000-000000000015', 'routine-outsider@example.invalid');

insert into public.households (id, name)
values
  ('10000000-0000-4000-8000-000000000011', 'Routine household one'),
  ('10000000-0000-4000-8000-000000000012', 'Routine household two');

insert into public.household_members (household_id, user_id, display_name)
values
  (
    '10000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000011',
    'Routine Member One'
  ),
  (
    '10000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000012',
    'Routine Member Two'
  ),
  (
    '10000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000013',
    'Routine Other One'
  ),
  (
    '10000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000014',
    'Routine Other Two'
  );

select is(
  (
    select count(*)::integer
    from public.areas
    where household_id = '10000000-0000-4000-8000-000000000011'
  ),
  6,
  'a new household receives six default areas'
);

select results_eq(
  $$
    select name, sort_order
    from public.areas
    where household_id = '10000000-0000-4000-8000-000000000011'
    order by sort_order
  $$,
  $$
    values
      ('Cleaning'::text, 1),
      ('Kitchen'::text, 2),
      ('Laundry'::text, 3),
      ('Dog'::text, 4),
      ('Meals'::text, 5),
      ('General'::text, 6)
  $$,
  'default areas have the product-defined order'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000011',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*)::integer from public.areas),
  6,
  'members read only their household areas'
);

select is_empty(
  $$
    update public.areas
    set name = 'Blocked cross-household edit'
    where household_id = '10000000-0000-4000-8000-000000000012'
    returning id
  $$,
  'RLS blocks cross-household area updates'
);

select throws_ok(
  $$
    select public.create_routine(
      p_household_id => '10000000-0000-4000-8000-000000000012',
      p_title => 'Cross-household routine',
      p_area_id => null,
      p_assignment_policy => 'shared',
      p_schedule_kind => 'calendar',
      p_schedule_rule => '{"kind":"daily"}'
    )
  $$,
  '42501',
  'caller is not a member of household 10000000-0000-4000-8000-000000000012',
  'the command boundary rejects cross-household callers'
);

select lives_ok(
  $$
    select public.create_routine(
      p_household_id => '10000000-0000-4000-8000-000000000011',
      p_title => 'Daily kitchen',
      p_area_id => (
        select id
        from public.areas
        where name = 'Kitchen'
      ),
      p_assignment_policy => 'alternating',
      p_schedule_kind => 'calendar',
      p_schedule_rule => '{"kind":"daily"}',
      p_rotation_anchor_member_id => '00000000-0000-4000-8000-000000000011',
      p_priority => 'cleaning',
      p_active_from => '2099-01-01'
    )
  $$,
  'create_routine accepts a valid daily alternating routine'
);

select is(
  (
    select count(*)::integer
    from public.routine_occurrences
    where routine_id = (
      select id from public.routines where title = 'Daily kitchen'
    )
      and status = 'open'
      and role = 'current'
  ),
  1,
  'daily creation opens one current occurrence'
);

select is(
  (
    select count(*)::integer
    from public.routine_occurrences
    where routine_id = (
      select id from public.routines where title = 'Daily kitchen'
    )
      and status = 'open'
      and role = 'preview'
  ),
  1,
  'daily creation opens one preview occurrence'
);

select results_eq(
  $$
    select due_date, planned_assignee_id
    from public.routine_occurrences
    where routine_id = (
      select id from public.routines where title = 'Daily kitchen'
    )
      and status = 'open'
    order by due_date
  $$,
  $$
    values
      (
        '2099-01-01'::date,
        '00000000-0000-4000-8000-000000000011'::uuid
      ),
      (
        '2099-01-02'::date,
        '00000000-0000-4000-8000-000000000012'::uuid
      )
  $$,
  'daily initial window follows the alternating planned sequence'
);

select lives_ok(
  $$
    insert into public.routine_reminder_preferences (
      routine_id,
      member_id,
      household_id,
      enabled,
      due_day_local_time
    )
    values (
      (select id from public.routines where title = 'Daily kitchen'),
      '00000000-0000-4000-8000-000000000011',
      '10000000-0000-4000-8000-000000000011',
      true,
      '08:30'
    )
  $$,
  'a member can enable their routine reminder'
);

select is(
  (
    select count(*)::integer
    from public.reminder_candidates
    where status = 'pending'
      and occurrence_id in (
        select id
        from public.routine_occurrences
        where routine_id = (
          select id from public.routines where title = 'Daily kitchen'
        )
      )
  ),
  2,
  'enabling a preference creates candidates for the open window'
);

select lives_ok(
  $$
    select public.complete_occurrence(
      (
        select id
        from public.routine_occurrences
        where routine_id = (
          select id from public.routines where title = 'Daily kitchen'
        )
          and status = 'open'
          and role = 'current'
      ),
      'daily-complete-1',
      '2099-01-01',
      'Done',
      null
    )
  $$,
  'complete_occurrence closes a current daily occurrence'
);

select ok(
  (
    select count(*) <= 1
    from public.routine_occurrences
    where routine_id = (
      select id from public.routines where title = 'Daily kitchen'
    )
      and status = 'open'
      and role = 'current'
  ),
  'daily completion leaves at most one open current occurrence'
);

select ok(
  (
    select count(*) <= 1
    from public.routine_occurrences
    where routine_id = (
      select id from public.routines where title = 'Daily kitchen'
    )
      and status = 'open'
      and role = 'preview'
  ),
  'daily completion leaves at most one open preview occurrence'
);

select results_eq(
  $$
    select role, due_date
    from public.routine_occurrences
    where routine_id = (
      select id from public.routines where title = 'Daily kitchen'
    )
      and status = 'open'
    order by due_date
  $$,
  $$
    values
      ('current'::text, '2099-01-02'::date),
      ('preview'::text, '2099-01-03'::date)
  $$,
  'daily completion promotes the preview and creates one successor preview'
);

select is(
  (
    select count(*)::integer
    from public.routine_completions
    where occurrence_id in (
      select id
      from public.routine_occurrences
      where routine_id = (
        select id from public.routines where title = 'Daily kitchen'
      )
    )
  ),
  1,
  'completion writes one completion row'
);

select is(
  (
    select count(*)::integer
    from public.reminder_candidates
    where status = 'cancelled'
      and occurrence_id in (
        select id
        from public.routine_occurrences
        where routine_id = (
          select id from public.routines where title = 'Daily kitchen'
        )
          and status = 'completed'
      )
  ),
  1,
  'completion cancels the closed occurrence reminder'
);

select is(
  (
    select count(*)::integer
    from public.reminder_candidates
    where status = 'pending'
      and occurrence_id in (
        select id
        from public.routine_occurrences
        where routine_id = (
          select id from public.routines where title = 'Daily kitchen'
        )
          and status = 'open'
      )
  ),
  2,
  'completion creates candidates for the resulting open window'
);

select is(
  public.complete_occurrence(
    (
      select id
      from public.routine_occurrences
      where routine_id = (
        select id from public.routines where title = 'Daily kitchen'
      )
        and status = 'completed'
      order by closed_at
      limit 1
    ),
    'daily-complete-1',
    '2099-01-01',
    'Ignored retry',
    null
  ) ->> 'status',
  'completed',
  'a repeated completion key returns the stored result'
);

select is(
  (
    select count(*)::integer
    from public.routine_completions
    where occurrence_id in (
      select id
      from public.routine_occurrences
      where routine_id = (
        select id from public.routines where title = 'Daily kitchen'
      )
    )
  ),
  1,
  'same-key completion retries create one completion'
);

select is(
  (
    select count(*)::integer
    from public.routine_command_receipts
    where household_id = '10000000-0000-4000-8000-000000000011'
      and idempotency_key = 'daily-complete-1'
  ),
  1,
  'same-key completion retries create one receipt'
);

select is(
  (
    select count(*)::integer
    from public.activity_events
    where kind = 'occurrence_completed'
      and entity_id in (
        select id
        from public.routine_occurrences
        where routine_id = (
          select id from public.routines where title = 'Daily kitchen'
        )
      )
  ),
  1,
  'completion writes one activity event'
);

select lives_ok(
  $$
    select public.create_routine(
      p_household_id => '10000000-0000-4000-8000-000000000011',
      p_title => 'Dog care interval',
      p_area_id => (
        select id from public.areas where name = 'Dog'
      ),
      p_assignment_policy => 'assigned',
      p_schedule_kind => 'after_completion',
      p_schedule_rule => '{"kind":"after_completion","every":3,"unit":"days"}',
      p_assigned_member_id => '00000000-0000-4000-8000-000000000012',
      p_priority => 'pet_care',
      p_active_from => '2099-02-01'
    )
  $$,
  'create_routine accepts completion-based recurrence'
);

select lives_ok(
  $$
    select public.complete_occurrence(
      (
        select id
        from public.routine_occurrences
        where routine_id = (
          select id from public.routines where title = 'Dog care interval'
        )
          and status = 'open'
          and role = 'current'
      ),
      'after-complete-1',
      '2099-02-10'
    )
  $$,
  'completion closes a completion-based occurrence'
);

select is(
  (
    select due_date
    from public.routine_occurrences
    where routine_id = (
      select id from public.routines where title = 'Dog care interval'
    )
      and status = 'open'
      and role = 'current'
  ),
  '2099-02-13'::date,
  'after_completion anchors the next current due date to completed_on'
);

select lives_ok(
  $$
    select public.skip_occurrence(
      (
        select id
        from public.routine_occurrences
        where routine_id = (
          select id from public.routines where title = 'Dog care interval'
        )
          and status = 'open'
          and role = 'current'
      ),
      'after-skip-1'
    )
  $$,
  'skip closes a completion-based occurrence'
);

select is(
  (
    select due_date
    from public.routine_occurrences
    where routine_id = (
      select id from public.routines where title = 'Dog care interval'
    )
      and status = 'open'
      and role = 'current'
  ),
  '2099-02-16'::date,
  'skip preserves completion-based cadence from the skipped due date'
);

select is(
  (
    select count(*)::integer
    from public.activity_events
    where kind = 'occurrence_skipped'
      and entity_id in (
        select id
        from public.routine_occurrences
        where routine_id = (
          select id from public.routines where title = 'Dog care interval'
        )
      )
  ),
  1,
  'skip writes an activity event'
);

select lives_ok(
  $$
    select public.create_routine(
      p_household_id => '10000000-0000-4000-8000-000000000011',
      p_title => 'Reschedule daily',
      p_area_id => (
        select id from public.areas where name = 'General'
      ),
      p_assignment_policy => 'shared',
      p_schedule_kind => 'calendar',
      p_schedule_rule => '{"kind":"daily"}',
      p_active_from => '2099-03-01'
    )
  $$,
  'create_routine accepts a shared routine'
);

select lives_ok(
  $$
    select public.reschedule_occurrence(
      (
        select id
        from public.routine_occurrences
        where routine_id = (
          select id from public.routines where title = 'Reschedule daily'
        )
          and status = 'open'
          and role = 'current'
      ),
      '2099-03-05',
      'reschedule-1'
    )
  $$,
  'reschedule moves an open current occurrence'
);

select results_eq(
  $$
    select role, due_date, original_due_date
    from public.routine_occurrences
    where routine_id = (
      select id from public.routines where title = 'Reschedule daily'
    )
      and status = 'open'
    order by due_date
  $$,
  $$
    values
      ('current'::text, '2099-03-05'::date, '2099-03-01'::date),
      ('preview'::text, '2099-03-06'::date, '2099-03-06'::date)
  $$,
  'reschedule keeps current open, preserves its origin, and refreshes preview'
);

select lives_ok(
  $$
    select public.skip_occurrence(
      (
        select id
        from public.routine_occurrences
        where routine_id = (
          select id from public.routines where title = 'Reschedule daily'
        )
          and status = 'open'
          and role = 'current'
      ),
      'archive-history-skip'
    )
  $$,
  'a routine can record history before archival'
);

select lives_ok(
  $$
    select public.archive_routine(
      (select id from public.routines where title = 'Reschedule daily')
    )
  $$,
  'archive_routine archives a routine'
);

select is(
  (
    select count(*)::integer
    from public.routine_occurrences
    where routine_id = (
      select id from public.routines where title = 'Reschedule daily'
    )
      and status = 'skipped'
  ),
  1,
  'archive preserves skipped occurrence history'
);

select is_empty(
  $$
    select id
    from public.routine_occurrences
    where routine_id = (
      select id from public.routines where title = 'Reschedule daily'
    )
      and status = 'open'
      and role = 'preview'
  $$,
  'archive discards the future preview'
);

select is(
  (
    select count(*)::integer
    from public.routine_occurrences
    where routine_id = (
      select id from public.routines where title = 'Reschedule daily'
    )
      and status = 'open'
      and role = 'current'
  ),
  1,
  'archive keeps the actionable current occurrence as history-in-waiting'
);

reset role;

select throws_ok(
  $$
    insert into public.routines (
      household_id,
      title,
      area_id,
      assignment_policy,
      schedule_kind,
      schedule_rule,
      priority
    )
    values (
      '10000000-0000-4000-8000-000000000011',
      'Cross-household area',
      (
        select id
        from public.areas
        where household_id = '10000000-0000-4000-8000-000000000012'
          and name = 'General'
      ),
      'shared',
      'calendar',
      '{"kind":"daily"}',
      'general'
    )
  $$,
  '23503',
  null,
  'the area composite foreign key rejects a cross-household area'
);

select * from finish();
rollback;
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
