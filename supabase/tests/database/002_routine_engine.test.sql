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
      p_household_id => '10000000-0000-4000-8000-000000000012'::uuid,
      p_title => 'Cross-household routine',
      p_area_id => null,
      p_assignment_policy => 'shared',
      p_schedule_kind => 'calendar',
      p_schedule_rule => '{"kind":"daily"}'::jsonb
    )
  $$,
  '42501',
  'caller is not a member of household 10000000-0000-4000-8000-000000000012',
  'the command boundary rejects cross-household callers'
);

select lives_ok(
  $$
    select public.create_routine(
      p_household_id => '10000000-0000-4000-8000-000000000011'::uuid,
      p_title => 'Daily kitchen',
      p_area_id => (
        select id
        from public.areas
        where name = 'Kitchen'
      ),
      p_assignment_policy => 'alternating',
      p_schedule_kind => 'calendar',
      p_schedule_rule => '{"kind":"daily"}'::jsonb,
      p_rotation_anchor_member_id => '00000000-0000-4000-8000-000000000011'::uuid,
      p_priority => 'cleaning',
      p_active_from => (timezone('Europe/Zurich', now()))::date
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
        (timezone('Europe/Zurich', now()))::date,
        '00000000-0000-4000-8000-000000000011'::uuid
      ),
      (
        (timezone('Europe/Zurich', now()))::date + 1,
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
      (timezone('Europe/Zurich', now()))::date,
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
      ('current'::text, (timezone('Europe/Zurich', now()))::date + 1),
      ('preview'::text, (timezone('Europe/Zurich', now()))::date + 2)
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
    (timezone('Europe/Zurich', now()))::date,
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

reset role;

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

set local role authenticated;

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
      p_household_id => '10000000-0000-4000-8000-000000000011'::uuid,
      p_title => 'Dog care interval',
      p_area_id => (
        select id from public.areas where name = 'Dog'
      ),
      p_assignment_policy => 'assigned',
      p_schedule_kind => 'after_completion',
      p_schedule_rule => '{"kind":"after_completion","every":3,"unit":"days"}'::jsonb,
      p_assigned_member_id => '00000000-0000-4000-8000-000000000012'::uuid,
      p_priority => 'pet_care',
      p_active_from => (timezone('Europe/Zurich', now()))::date
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
      (timezone('Europe/Zurich', now()))::date + 9
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
  (timezone('Europe/Zurich', now()))::date + 12,
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
  (timezone('Europe/Zurich', now()))::date + 15,
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
      p_household_id => '10000000-0000-4000-8000-000000000011'::uuid,
      p_title => 'Reschedule daily',
      p_area_id => (
        select id from public.areas where name = 'General'
      ),
      p_assignment_policy => 'shared',
      p_schedule_kind => 'calendar',
      p_schedule_rule => '{"kind":"daily"}'::jsonb,
      p_active_from => (timezone('Europe/Zurich', now()))::date
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
      (timezone('Europe/Zurich', now()))::date + 4,
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
      ('preview'::text, (timezone('Europe/Zurich', now()))::date + 1, (timezone('Europe/Zurich', now()))::date + 1),
      ('current'::text, (timezone('Europe/Zurich', now()))::date + 4, (timezone('Europe/Zurich', now()))::date)
  $$,
  'reschedule keeps current open and preserves the calendar preview anchor'
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


select lives_ok(
  $$
    select public.update_routine_definition(
      p_routine_id => (select id from public.routines where title = 'Daily kitchen'),
      p_schedule_kind => 'calendar',
      p_schedule_rule => '{"kind":"weekly","weekday":1}'::jsonb,
      p_assignment_policy => 'shared',
      p_rebuild_window => true
    )
  $$,
  'update_routine_definition can change schedule and assignment'
);

select is(
  (
    select schedule_rule->>'kind'
    from public.routines
    where title = 'Daily kitchen'
  ),
  'weekly',
  'schedule updates persist on the routine definition'
);

select is(
  (
    select count(*)::integer
    from public.activity_events
    where kind = 'routine_updated'
      and household_id = '10000000-0000-4000-8000-000000000011'
  ) >= 1,
  true,
  'schedule updates write activity history'
);


select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000011',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

insert into public.pets (household_id, name)
values ('10000000-0000-4000-8000-000000000011', 'Routine Edit Pet');

select lives_ok(
  $$
    update public.routines
    set instructions = 'Direct optional-field edit',
        pet_id = (
          select id
          from public.pets
          where name = 'Routine Edit Pet'
        )
    where household_id = '10000000-0000-4000-8000-000000000011'
      and title = 'Daily kitchen'
  $$,
  'members can set routine instructions and pet directly under column grants'
);

select is(
  (
    select pet.name
    from public.routines as routine
    join public.pets as pet on pet.id = routine.pet_id
    where routine.title = 'Daily kitchen'
  ),
  'Routine Edit Pet',
  'the direct optional-field update persists the pet link'
);

select lives_ok(
  $$
    update public.routines
    set instructions = null,
        pet_id = null
    where household_id = '10000000-0000-4000-8000-000000000011'
      and title = 'Daily kitchen'
  $$,
  'members can clear routine instructions and pet directly'
);

select is(
  (
    select instructions is null and pet_id is null
    from public.routines
    where title = 'Daily kitchen'
  ),
  true,
  'the direct optional-field update can null both fields'
);

reset role;

select ok(
  private.is_valid_routine_schedule(
    'calendar',
    '{"kind":"biweekly","weekday":3}'::jsonb
  ),
  'biweekly rules validate on the calendar kind'
);

select ok(
  not private.is_valid_routine_schedule(
    'calendar',
    '{"kind":"biweekly","weekday":8}'::jsonb
  ),
  'biweekly weekdays outside 1-7 are rejected'
);

select ok(
  not private.is_valid_routine_schedule(
    'after_completion',
    '{"kind":"biweekly","weekday":3}'::jsonb
  ),
  'biweekly rules are rejected under the after_completion kind'
);

select is(
  private.first_routine_due_date(
    '{"kind":"biweekly","weekday":1}'::jsonb,
    date '2026-08-05'
  ),
  date '2026-08-10',
  'biweekly first due date lands on the next matching weekday'
);

select is(
  private.next_routine_due_date(
    '{"kind":"biweekly","weekday":1}'::jsonb,
    date '2026-08-10'
  ),
  date '2026-08-24',
  'biweekly closure on the weekday advances fourteen days'
);

select is(
  private.next_routine_due_date(
    '{"kind":"biweekly","weekday":1}'::jsonb,
    date '2026-08-12'
  ),
  date '2026-08-24',
  'biweekly closure without an anchor re-anchors in the week after next'
);

select is(
  private.next_routine_due_date(
    '{"kind":"biweekly","weekday":1}'::jsonb,
    date '2026-08-17',
    null,
    date '2026-08-10'
  ),
  date '2026-08-24',
  'biweekly succession anchors on the original due date after a reschedule'
);

select lives_ok(
  $$
    select public.update_routine_definition(
      p_routine_id => (select id from public.routines where title = 'Daily kitchen'),
      p_schedule_kind => 'calendar',
      p_schedule_rule => '{"kind":"biweekly","weekday":1}'::jsonb,
      p_rebuild_window => true
    )
  $$,
  'update_routine_definition accepts a biweekly schedule'
);

select is(
  (
    select preview_occurrence.due_date - current_occurrence.due_date
    from public.routine_occurrences as current_occurrence
    join public.routine_occurrences as preview_occurrence
      on preview_occurrence.routine_id = current_occurrence.routine_id
    where current_occurrence.routine_id
        = (select id from public.routines where title = 'Daily kitchen')
      and current_occurrence.status = 'open'
      and current_occurrence.role = 'current'
      and preview_occurrence.status = 'open'
      and preview_occurrence.role = 'preview'
  ),
  14,
  'a biweekly window previews fourteen days after the current occurrence'
);

select is(
  private.first_rebuild_due_date(
    '{"kind":"biweekly","weekday":1}'::jsonb,
    '{"kind":"biweekly","weekday":1}'::jsonb,
    date '2026-08-10',
    date '2026-08-17'
  ),
  date '2026-08-24',
  'an unchanged biweekly rule rebuilds on the anchored cadence'
);

select is(
  private.first_rebuild_due_date(
    '{"kind":"biweekly","weekday":1}'::jsonb,
    '{"kind":"biweekly","weekday":1}'::jsonb,
    date '2026-08-24',
    date '2026-08-17'
  ),
  date '2026-08-24',
  'a future biweekly anchor is kept as the rebuilt first due date'
);

select is(
  private.first_rebuild_due_date(
    '{"kind":"biweekly","weekday":2}'::jsonb,
    '{"kind":"biweekly","weekday":1}'::jsonb,
    date '2026-08-10',
    date '2026-08-17'
  ),
  date '2026-08-18',
  'a changed biweekly rule re-anchors from the rebuild day'
);

select is(
  private.first_rebuild_due_date(
    '{"kind":"weekly","weekday":1}'::jsonb,
    '{"kind":"weekly","weekday":1}'::jsonb,
    date '2026-08-10',
    date '2026-08-17'
  ),
  date '2026-08-17',
  'non-biweekly rules rebuild from the rebuild day as before'
);

-- Simulate an elapsed biweekly cycle so the open window sits on the other
-- week of the cadence, then rebuild for an assignment-only change.
update public.routine_occurrences
set due_date = due_date + 14,
    original_due_date = original_due_date + 14
where routine_id = (select id from public.routines where title = 'Daily kitchen')
  and status = 'open';

select lives_ok(
  $$
    select public.update_routine_definition(
      p_routine_id => (select id from public.routines where title = 'Daily kitchen'),
      p_assignment_policy => 'assigned',
      p_assigned_member_id => '00000000-0000-4000-8000-000000000012',
      p_rebuild_window => true
    )
  $$,
  'assignment-only updates rebuild the biweekly window'
);

select is(
  (
    select occurrence.due_date
    from public.routine_occurrences as occurrence
    where occurrence.routine_id
        = (select id from public.routines where title = 'Daily kitchen')
      and occurrence.status = 'open'
      and occurrence.role = 'current'
  ),
  private.first_routine_due_date(
    '{"kind":"biweekly","weekday":1}'::jsonb,
    private.household_today()
  ) + 14,
  'an assignment-only rebuild keeps the biweekly phase'
);

-- A rebuild with an unchanged schedule rule recreates the current occurrence
-- as it was: a reschedule survives an assignment-only edit and the preview
-- keeps following the original recurrence anchor.
select lives_ok(
  $$
    select public.create_routine(
      p_household_id => '10000000-0000-4000-8000-000000000011'::uuid,
      p_title => 'Weekly keep reschedule',
      p_area_id => (
        select id
        from public.areas
        where household_id = '10000000-0000-4000-8000-000000000011'
          and name = 'General'
      ),
      p_assignment_policy => 'shared',
      p_schedule_kind => 'calendar',
      p_schedule_rule => '{"kind":"weekly","weekday":1}'::jsonb,
      p_active_from => (timezone('Europe/Zurich', now()))::date
    )
  $$,
  'create_routine accepts a weekly routine for reschedule preservation'
);

select lives_ok(
  $$
    select public.reschedule_occurrence(
      (
        select id
        from public.routine_occurrences
        where routine_id = (
          select id from public.routines where title = 'Weekly keep reschedule'
        )
          and status = 'open'
          and role = 'current'
      ),
      (
        select due_date + 3
        from public.routine_occurrences
        where routine_id = (
          select id from public.routines where title = 'Weekly keep reschedule'
        )
          and status = 'open'
          and role = 'current'
      ),
      'preserve-reschedule-weekly'
    )
  $$,
  'a weekly current occurrence can be rescheduled before an edit'
);

select lives_ok(
  $$
    select public.update_routine_definition(
      p_routine_id => (
        select id from public.routines where title = 'Weekly keep reschedule'
      ),
      p_assignment_policy => 'assigned',
      p_assigned_member_id => '00000000-0000-4000-8000-000000000011',
      p_rebuild_window => true
    )
  $$,
  'assignment-only updates rebuild a rescheduled weekly window'
);

select results_eq(
  $$
    select role, due_date, original_due_date
    from public.routine_occurrences
    where routine_id = (
      select id from public.routines where title = 'Weekly keep reschedule'
    )
      and status = 'open'
    order by due_date
  $$,
  $$
    select
      occurrence.role,
      anchor.due_date + occurrence.due_offset,
      anchor.due_date + occurrence.original_offset
    from (
      select private.first_routine_due_date(
        '{"kind":"weekly","weekday":1}'::jsonb,
        private.household_today()
      ) as due_date
    ) as anchor,
    (
      values
        ('current'::text, 3, 0),
        ('preview'::text, 7, 7)
    ) as occurrence(role, due_offset, original_offset)
    order by occurrence.due_offset
  $$,
  'an assignment-only rebuild keeps a weekly reschedule and its anchor'
);

select is(
  (
    select occurrence_id is null
    from public.routine_command_receipts
    where household_id = '10000000-0000-4000-8000-000000000011'
      and idempotency_key = 'preserve-reschedule-weekly'
  ),
  true,
  'the reschedule receipt survives the rebuild unlinked from its occurrence'
);

select lives_ok(
  $$
    select public.create_routine(
      p_household_id => '10000000-0000-4000-8000-000000000011'::uuid,
      p_title => 'Biweekly keep reschedule',
      p_area_id => (
        select id
        from public.areas
        where household_id = '10000000-0000-4000-8000-000000000011'
          and name = 'General'
      ),
      p_assignment_policy => 'shared',
      p_schedule_kind => 'calendar',
      p_schedule_rule => '{"kind":"biweekly","weekday":1}'::jsonb,
      p_active_from => (timezone('Europe/Zurich', now()))::date
    )
  $$,
  'create_routine accepts a biweekly routine for reschedule preservation'
);

select lives_ok(
  $$
    select public.reschedule_occurrence(
      (
        select id
        from public.routine_occurrences
        where routine_id = (
          select id from public.routines where title = 'Biweekly keep reschedule'
        )
          and status = 'open'
          and role = 'current'
      ),
      (
        select due_date + 3
        from public.routine_occurrences
        where routine_id = (
          select id from public.routines where title = 'Biweekly keep reschedule'
        )
          and status = 'open'
          and role = 'current'
      ),
      'preserve-reschedule-biweekly'
    )
  $$,
  'a biweekly current occurrence can be rescheduled before an edit'
);

select lives_ok(
  $$
    select public.update_routine_definition(
      p_routine_id => (
        select id from public.routines where title = 'Biweekly keep reschedule'
      ),
      p_assignment_policy => 'assigned',
      p_assigned_member_id => '00000000-0000-4000-8000-000000000012',
      p_rebuild_window => true
    )
  $$,
  'assignment-only updates rebuild a rescheduled biweekly window'
);

select results_eq(
  $$
    select role, due_date, original_due_date
    from public.routine_occurrences
    where routine_id = (
      select id from public.routines where title = 'Biweekly keep reschedule'
    )
      and status = 'open'
    order by due_date
  $$,
  $$
    select
      occurrence.role,
      anchor.due_date + occurrence.due_offset,
      anchor.due_date + occurrence.original_offset
    from (
      select private.first_routine_due_date(
        '{"kind":"biweekly","weekday":1}'::jsonb,
        private.household_today()
      ) as due_date
    ) as anchor,
    (
      values
        ('current'::text, 3, 0),
        ('preview'::text, 14, 14)
    ) as occurrence(role, due_offset, original_offset)
    order by occurrence.due_offset
  $$,
  'an assignment-only rebuild keeps a biweekly reschedule and its anchor'
);

-- A changed schedule rule still re-anchors: the pending reschedule on the
-- biweekly routine above is discarded and the window rebuilds from today.
select lives_ok(
  $$
    select public.update_routine_definition(
      p_routine_id => (
        select id from public.routines where title = 'Biweekly keep reschedule'
      ),
      p_schedule_kind => 'calendar',
      p_schedule_rule => '{"kind":"biweekly","weekday":2}'::jsonb,
      p_rebuild_window => true
    )
  $$,
  'a schedule-rule change rebuilds a rescheduled window'
);

select results_eq(
  $$
    select role, due_date, original_due_date
    from public.routine_occurrences
    where routine_id = (
      select id from public.routines where title = 'Biweekly keep reschedule'
    )
      and status = 'open'
    order by due_date
  $$,
  $$
    select
      occurrence.role,
      anchor.due_date + occurrence.due_offset,
      anchor.due_date + occurrence.due_offset
    from (
      select private.first_routine_due_date(
        '{"kind":"biweekly","weekday":2}'::jsonb,
        private.household_today()
      ) as due_date
    ) as anchor,
    (
      values
        ('current'::text, 0),
        ('preview'::text, 14)
    ) as occurrence(role, due_offset)
    order by occurrence.due_offset
  $$,
  'a schedule-rule change re-anchors and discards the reschedule'
);

select * from finish();
rollback;
