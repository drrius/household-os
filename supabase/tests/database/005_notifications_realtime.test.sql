begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

select has_table('public', 'inbox_notifications', 'inbox table exists');
select has_table(
  'public',
  'notification_digest_preferences',
  'digest preferences table exists'
);
select has_table(
  'public',
  'push_subscriptions',
  'push subscriptions table exists'
);
select has_table('public', 'push_outbox', 'push outbox table exists');
select has_table('public', 'job_claims', 'job claims table exists');
select has_extension('pg_net', 'pg_net is enabled for scheduled Edge invocation');
select has_schema('net', 'pg_net exposes the async HTTP schema');

select ok(
  (
    select count(*) = 5 and bool_and(relrowsecurity)
    from pg_class
    where oid in (
      'public.inbox_notifications'::regclass,
      'public.notification_digest_preferences'::regclass,
      'public.push_subscriptions'::regclass,
      'public.push_outbox'::regclass,
      'public.job_claims'::regclass
    )
  ),
  'RLS is enabled on every notification and job table'
);

select ok(
  not exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'upsert_digest_preference',
        'mark_inbox_notifications_read',
        'register_push_subscription',
        'unregister_push_subscription',
        'run_deliver_due_reminders',
        'run_deliver_member_digests',
        'run_retain_activity_events',
        'run_retain_purchased_groceries',
        'run_ensure_due_occurrences',
        'run_generate_recurring_drafts_cron',
        'run_drain_push_outbox'
      )
      and has_function_privilege('anon', pg_proc.oid, 'execute')
  ),
  'anonymous clients cannot execute member or Cron RPCs'
);

select is(
  (
    select count(*)::integer
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'upsert_digest_preference',
        'mark_inbox_notifications_read',
        'register_push_subscription',
        'unregister_push_subscription'
      )
      and has_function_privilege('authenticated', pg_proc.oid, 'execute')
  ),
  4,
  'authenticated clients can execute every member notification RPC'
);

select ok(
  not exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'run_deliver_due_reminders',
        'run_deliver_member_digests',
        'run_retain_activity_events',
        'run_retain_purchased_groceries',
        'run_ensure_due_occurrences',
        'run_generate_recurring_drafts_cron',
        'run_drain_push_outbox'
      )
      and has_function_privilege('authenticated', pg_proc.oid, 'execute')
  ),
  'authenticated clients cannot execute Cron RPCs'
);

select is(
  (
    select count(*)::integer
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'run_deliver_due_reminders',
        'run_deliver_member_digests',
        'run_retain_activity_events',
        'run_retain_purchased_groceries',
        'run_ensure_due_occurrences',
        'run_generate_recurring_drafts_cron',
        'run_drain_push_outbox'
      )
      and has_function_privilege('service_role', pg_proc.oid, 'execute')
  ),
  7,
  'service_role can execute every Cron RPC'
);

select has_function(
  'private',
  'invoke_push_dispatch',
  'invoke_push_dispatch exists for Edge Web Push transport'
);

select ok(
  has_function_privilege(
    'service_role',
    'private.invoke_push_dispatch()',
    'execute'
  ),
  'service_role can execute invoke_push_dispatch'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.invoke_push_dispatch()',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'private.invoke_push_dispatch()',
    'execute'
  ),
  'clients cannot execute invoke_push_dispatch'
);

select has_function(
  'public',
  'claim_push_outbox',
  array['integer', 'integer', 'uuid[]'],
  'claim_push_outbox exists for atomic Edge delivery leases'
);

select has_function(
  'public',
  'finalize_push_outbox_claim',
  array['uuid', 'uuid', 'text', 'text', 'uuid[]'],
  'finalize_push_outbox_claim exists for owned delivery completion'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.claim_push_outbox(integer,integer,uuid[])',
    'execute'
  )
  and has_function_privilege(
    'service_role',
    'public.finalize_push_outbox_claim(uuid,uuid,text,text,uuid[])',
    'execute'
  ),
  'service_role can execute the push claim lease RPCs'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.claim_push_outbox(integer,integer,uuid[])',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.claim_push_outbox(integer,integer,uuid[])',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.finalize_push_outbox_claim(uuid,uuid,text,text,uuid[])',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.finalize_push_outbox_claim(uuid,uuid,text,text,uuid[])',
    'execute'
  ),
  'clients cannot execute the push claim lease RPCs'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.inbox_notifications',
    'insert'
  )
    and not has_table_privilege(
      'authenticated',
      'public.inbox_notifications',
      'update'
    )
    and not has_table_privilege(
      'authenticated',
      'public.inbox_notifications',
      'delete'
    )
    and not has_table_privilege(
      'authenticated',
      'public.push_outbox',
      'select'
    ),
  'authenticated clients cannot write inbox rows or read push outbox'
);

select set_eq(
  $$
    select tablename::text
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in (
        'inbox_notifications',
        'routine_occurrences',
        'routines',
        'meal_plan_entries',
        'grocery_items',
        'shopping_sessions',
        'expense_drafts',
        'financial_events',
        'activity_events'
      )
  $$,
  $$
    values
      ('inbox_notifications'::text),
      ('routine_occurrences'::text),
      ('routines'::text),
      ('meal_plan_entries'::text),
      ('grocery_items'::text),
      ('shopping_sessions'::text),
      ('expense_drafts'::text),
      ('financial_events'::text),
      ('activity_events'::text)
  $$,
  'Realtime publishes every browser-observable invalidation table'
);

select ok(
  not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in ('push_outbox', 'job_claims')
  ),
  'Realtime does not publish push outbox or job claims'
);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000051', 'notify-one@example.invalid'),
  ('00000000-0000-4000-8000-000000000052', 'notify-two@example.invalid'),
  ('00000000-0000-4000-8000-000000000053', 'notify-other-one@example.invalid'),
  ('00000000-0000-4000-8000-000000000054', 'notify-other-two@example.invalid');

insert into public.households (id, name)
values
  ('10000000-0000-4000-8000-000000000051', 'Notify household one'),
  ('10000000-0000-4000-8000-000000000052', 'Notify household two');

insert into public.household_members (household_id, user_id, display_name)
values
  (
    '10000000-0000-4000-8000-000000000051',
    '00000000-0000-4000-8000-000000000051',
    'Notify Member One'
  ),
  (
    '10000000-0000-4000-8000-000000000051',
    '00000000-0000-4000-8000-000000000052',
    'Notify Member Two'
  ),
  (
    '10000000-0000-4000-8000-000000000052',
    '00000000-0000-4000-8000-000000000053',
    'Notify Other One'
  ),
  (
    '10000000-0000-4000-8000-000000000052',
    '00000000-0000-4000-8000-000000000054',
    'Notify Other Two'
  );

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000051',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.post_manual_expense(
      p_household_id => '10000000-0000-4000-8000-000000000051',
      p_description => 'Notification expense',
      p_amount_cents => 1000,
      p_payer_member_id => '00000000-0000-4000-8000-000000000051',
      p_allocations => '[
        {"memberId":"00000000-0000-4000-8000-000000000051","allocatedCents":500},
        {"memberId":"00000000-0000-4000-8000-000000000052","allocatedCents":500}
      ]',
      p_occurred_on => (timezone('Europe/Zurich', now()))::date,
      p_idempotency_key => 'notify-expense-1'
    )
  $$,
  'member one can post an expense'
);

select is(
  (
    select count(*)::integer
    from public.inbox_notifications
  ),
  0,
  'the actor cannot read the partner-only notice'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.inbox_notifications
    where household_id = '10000000-0000-4000-8000-000000000051'
      and recipient_member_id = '00000000-0000-4000-8000-000000000052'
      and activity_kind = 'expense_posted'
  ),
  1,
  'posting an expense creates one inbox notice for the other member'
);

select is(
  (
    select count(*)::integer
    from public.inbox_notifications
    where household_id = '10000000-0000-4000-8000-000000000051'
      and recipient_member_id = '00000000-0000-4000-8000-000000000051'
      and kind = 'partner_notice'
  ),
  0,
  'posting an expense never creates a notice for its actor'
);

select is(
  (
    select outbox.status
    from public.push_outbox as outbox
    join public.inbox_notifications as inbox
      on inbox.id = outbox.inbox_notification_id
    where inbox.household_id = '10000000-0000-4000-8000-000000000051'
      and inbox.activity_kind = 'expense_posted'
  ),
  'skipped_no_subscription',
  'missing push permission skips push without dropping the inbox notice'
);

select throws_ok(
  $$
    select private.deliver_partner_notice(
      '10000000-0000-4000-8000-000000000051',
      '00000000-0000-4000-8000-000000000051',
      'missing_catalog_kind',
      'financial_event',
      '30000000-0000-4000-8000-000000000051',
      '{}'::jsonb,
      '40000000-0000-4000-8000-000000000051'
    )
  $$,
  '22023',
  'unknown activity kind for partner notify: missing_catalog_kind',
  'unknown partner notification kinds fail loudly'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000053',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*)::integer from public.inbox_notifications),
  0,
  'a member cannot read another household inbox'
);

reset role;

insert into public.push_subscriptions (
  id,
  household_id,
  member_id,
  endpoint,
  p256dh,
  auth,
  user_agent
)
values
  (
    '70000000-0000-4000-8000-000000000051',
    '10000000-0000-4000-8000-000000000051',
    '00000000-0000-4000-8000-000000000052',
    'https://push.example.invalid/claim-one',
    'claim-p256dh-one',
    'claim-auth-one',
    'pgTAP claim one'
  ),
  (
    '70000000-0000-4000-8000-000000000052',
    '10000000-0000-4000-8000-000000000051',
    '00000000-0000-4000-8000-000000000052',
    'https://push.example.invalid/claim-two',
    'claim-p256dh-two',
    'claim-auth-two',
    'pgTAP claim two'
  ),
  (
    '70000000-0000-4000-8000-000000000053',
    '10000000-0000-4000-8000-000000000051',
    '00000000-0000-4000-8000-000000000052',
    'https://push.example.invalid/claim-three',
    'claim-p256dh-three',
    'claim-auth-three',
    'pgTAP claim three'
  ),
  (
    '70000000-0000-4000-8000-000000000054',
    '10000000-0000-4000-8000-000000000052',
    '00000000-0000-4000-8000-000000000053',
    'https://push.example.invalid/foreign-claim',
    'foreign-claim-p256dh',
    'foreign-claim-auth',
    'pgTAP foreign claim'
  );

insert into public.inbox_notifications (
  id,
  household_id,
  recipient_member_id,
  kind,
  activity_kind,
  entity_type,
  dedupe_key,
  created_at
)
values
  (
    '60000000-0000-4000-8000-000000000051',
    '10000000-0000-4000-8000-000000000051',
    '00000000-0000-4000-8000-000000000052',
    'partner_notice',
    'expense_posted',
    'financial_event',
    'push-claim-test-one',
    '2000-01-01 00:00:00+00'
  ),
  (
    '60000000-0000-4000-8000-000000000052',
    '10000000-0000-4000-8000-000000000051',
    '00000000-0000-4000-8000-000000000052',
    'partner_notice',
    'expense_posted',
    'financial_event',
    'push-claim-test-two',
    '2000-01-01 00:00:01+00'
  );

insert into public.push_outbox (
  id,
  household_id,
  recipient_member_id,
  inbox_notification_id,
  created_at
)
values
  (
    '65000000-0000-4000-8000-000000000051',
    '10000000-0000-4000-8000-000000000051',
    '00000000-0000-4000-8000-000000000052',
    '60000000-0000-4000-8000-000000000051',
    '2000-01-01 00:00:00+00'
  ),
  (
    '65000000-0000-4000-8000-000000000052',
    '10000000-0000-4000-8000-000000000051',
    '00000000-0000-4000-8000-000000000052',
    '60000000-0000-4000-8000-000000000052',
    '2000-01-01 00:00:01+00'
  );

set local role service_role;

create temporary table first_push_claim as
select * from public.claim_push_outbox(1, 120);

create temporary table second_push_claim as
select * from public.claim_push_outbox(1, 120);

select is(
  (select count(*)::integer from first_push_claim),
  1,
  'a push claim returns one bounded row'
);

select is(
  (select count(*)::integer from second_push_claim),
  1,
  'an overlapping push claim returns another bounded row'
);

select isnt(
  (select id from first_push_claim),
  (select id from second_push_claim),
  'overlapping claims own disjoint outbox rows'
);

update public.push_outbox
set
  claimed_at = now() - interval '2 seconds',
  claim_expires_at = now() - interval '1 second'
where id = (select id from first_push_claim);

create temporary table recovered_push_claim as
select * from public.claim_push_outbox(1, 120);

select is(
  (select id from recovered_push_claim),
  (select id from first_push_claim),
  'an expired push lease is reclaimed'
);

select is(
  public.finalize_push_outbox_claim(
    (select id from first_push_claim),
    (select claim_token from first_push_claim),
    'sent'
  ),
  false,
  'a stale claim token cannot finalize a reclaimed row'
);

select is(
  public.finalize_push_outbox_claim(
    (select id from recovered_push_claim),
    (select claim_token from recovered_push_claim),
    'deferred',
    'vapid secrets not configured',
    array['70000000-0000-4000-8000-000000000051'::uuid]
  ),
  true,
  'the current claim owner can defer without dropping the row'
);

select ok(
  (
    select status = 'pending'
      and attempt_count = 0
      and claim_token is null
      and processed_at is null
      and delivered_subscription_ids = array[
        '70000000-0000-4000-8000-000000000051'::uuid
      ]
    from public.push_outbox
    where id = (select id from recovered_push_claim)
  ),
  'deferred finalization releases the lease without consuming an attempt'
);

delete from public.push_subscriptions
where id = '70000000-0000-4000-8000-000000000051';

select ok(
  not exists (
    select 1
    from public.push_subscriptions
    where id = '70000000-0000-4000-8000-000000000051'
  ),
  'a previously successful device can be unregistered before another retry'
);

select is(
  public.finalize_push_outbox_claim(
    (select id from second_push_claim),
    (select claim_token from second_push_claim),
    'deferred',
    'worker will continue with another row'
  ),
  true,
  'the second pending row can be released for the exclusion test'
);

create temporary table excluded_push_claim as
select *
from public.claim_push_outbox(
  1,
  120,
  array[(select id from first_push_claim)]
);

select is(
  (select id from excluded_push_claim),
  (select id from second_push_claim),
  'a deferred oldest row is excluded so the worker claims the next row'
);

select is(
  public.finalize_push_outbox_claim(
    (select id from excluded_push_claim),
    (select claim_token from excluded_push_claim),
    'deferred',
    'exclusion test complete'
  ),
  true,
  'the exclusion-test claim is released'
);

create temporary table retry_push_claim as
select * from public.claim_push_outbox(1, 120);

select throws_ok(
  format(
    $$
      select public.finalize_push_outbox_claim(
        %L::uuid,
        %L::uuid,
        'failed',
        'foreign subscription test',
        array['70000000-0000-4000-8000-000000000054'::uuid]
      )
    $$,
    (select id from retry_push_claim),
    (select claim_token from retry_push_claim)
  ),
  '22023',
  'delivered subscription does not belong to claimed recipient',
  'finalization rejects an existing subscription owned by another recipient'
);

delete from public.push_subscriptions
where id = '70000000-0000-4000-8000-000000000053';

select ok(
  not exists (
    select 1
    from public.push_subscriptions
    where id = '70000000-0000-4000-8000-000000000053'
  ),
  'a newly successful device can be unregistered before finalization'
);

select is(
  public.finalize_push_outbox_claim(
    (select id from retry_push_claim),
    (select claim_token from retry_push_claim),
    'failed',
    'transient push failure',
    array[
      '70000000-0000-4000-8000-000000000051'::uuid,
      '70000000-0000-4000-8000-000000000052'::uuid,
      '70000000-0000-4000-8000-000000000053'::uuid
    ]
  ),
  true,
  'the current claim owner can record a retryable failure'
);

select ok(
  (
    select status = 'pending'
      and attempt_count = 1
      and delivered_subscription_ids @> array[
        '70000000-0000-4000-8000-000000000051'::uuid,
        '70000000-0000-4000-8000-000000000052'::uuid,
        '70000000-0000-4000-8000-000000000053'::uuid
      ]
    from public.push_outbox
    where id = (select id from retry_push_claim)
  ),
  'retry finalization preserves stored, current, and newly unregistered successes'
);

update public.push_outbox
set attempt_count = 4
where id = (select id from retry_push_claim);

create temporary table exhausted_push_claim as
select * from public.claim_push_outbox(1, 120);

select is(
  public.finalize_push_outbox_claim(
    (select id from exhausted_push_claim),
    (select claim_token from exhausted_push_claim),
    'failed',
    'final transient push failure'
  ),
  true,
  'the current owner can finalize the last allowed attempt'
);

select ok(
  (
    select status = 'failed'
      and attempt_count = 5
      and processed_at is not null
      and claim_token is null
    from public.push_outbox
    where id = (select id from exhausted_push_claim)
  ),
  'the fifth delivery failure terminally exhausts the outbox row'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000052',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (public.upsert_digest_preference(true, '08:00'::time) ->> 'enabled')::boolean,
  true,
  'a member can upsert their digest preference'
);

select lives_ok(
  $$
    select public.register_push_subscription(
      'https://push.example.invalid/member-two',
      'p256dh-key',
      'auth-key',
      'pgTAP'
    )
  $$,
  'a member can register a push subscription'
);

select lives_ok(
  $$
    select public.unregister_push_subscription(
      'https://push.example.invalid/member-two'
    )
  $$,
  'a member can unregister a push subscription'
);

reset role;

select ok(
  (
    select disabled_at is not null
    from public.push_subscriptions
    where endpoint = 'https://push.example.invalid/member-two'
  ),
  'unregistering disables the member push subscription'
);

insert into public.expense_drafts (
  id,
  household_id,
  source_kind,
  description,
  amount_cents,
  payer_member_id,
  proposed_allocations,
  occurred_on,
  status
)
values (
  '20000000-0000-4000-8000-000000000051',
  '10000000-0000-4000-8000-000000000051',
  'recurring',
  'Pending digest draft',
  500,
  '00000000-0000-4000-8000-000000000051',
  '[]'::jsonb,
  (timezone('Europe/Zurich', now()))::date,
  'pending'
);

set local role service_role;

select is(
  public.run_deliver_member_digests(
    'deliver_member_digests:global:test-slot-1',
    '08:00'::time,
    50
  ) ->> 'decision',
  'run',
  'the digest runner materializes the configured slot'
);

select ok(
  (
    select payload ? 'pendingFinancialDrafts'
      and payload::text !~* '"[^"]*(balance|owed|debt|ledger)[^"]*"'
    from public.inbox_notifications
    where kind = 'household_digest'
      and recipient_member_id = '00000000-0000-4000-8000-000000000052'
  ),
  'a materialized digest has live drafts and no balance or owed keys'
);

select ok(
  pg_get_functiondef(
    'public.run_deliver_member_digests(text,time,integer)'::regprocedure
  ) !~* '(ledger_entries|receivable_delta|owed_balance)',
  'the digest SQL never reads the ledger or a derived balance'
);

select is(
  public.run_deliver_member_digests(
    'deliver_member_digests:global:test-slot-1',
    '08:00'::time,
    50
  ) ->> 'decision',
  'already_succeeded',
  'replaying a digest schedule key returns the completed claim'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000051',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.create_routine(
      p_household_id => '10000000-0000-4000-8000-000000000051',
      p_title => 'Reminder cancellation routine',
      p_area_id => (
        select id
        from public.areas
        where household_id = '10000000-0000-4000-8000-000000000051'
          and name = 'General'
      ),
      p_assignment_policy => 'assigned',
      p_schedule_kind => 'one_off',
      p_schedule_rule => jsonb_build_object(
        'kind',
        'one_off',
        'date',
        (timezone('Europe/Zurich', now()))::date
      ),
      p_assigned_member_id => '00000000-0000-4000-8000-000000000052',
      p_active_from => (timezone('Europe/Zurich', now()))::date,
      p_active_until => (timezone('Europe/Zurich', now()))::date
    )
  $$,
  'a member can create a due routine for reminder delivery'
);

reset role;

insert into public.routine_reminder_preferences (
  routine_id,
  member_id,
  household_id,
  enabled,
  due_day_local_time
)
select
  routine.id,
  '00000000-0000-4000-8000-000000000052',
  routine.household_id,
  true,
  '00:00'::time
from public.routines as routine
where routine.title = 'Reminder cancellation routine';

set local role service_role;

select is(
  public.run_deliver_due_reminders(
    'deliver_due_reminders:global:test-slot-1',
    100
  ) ->> 'decision',
  'run',
  'the reminder runner delivers a due candidate'
);

select is(
  (
    select count(*)::integer
    from public.inbox_notifications
    where kind = 'routine_reminder'
      and recipient_member_id = '00000000-0000-4000-8000-000000000052'
  ),
  1,
  'a due reminder creates one inbox row'
);

select is(
  public.run_deliver_due_reminders(
    'deliver_due_reminders:global:test-slot-1',
    100
  ) ->> 'decision',
  'already_succeeded',
  'replaying a reminder schedule key returns the completed claim'
);

select is(
  (
    select count(*)::integer
    from public.inbox_notifications
    where kind = 'routine_reminder'
      and recipient_member_id = '00000000-0000-4000-8000-000000000052'
  ),
  1,
  'replaying a reminder schedule key does not double-deliver'
);

select is(
  (
    select attempt_count
    from public.job_claims
    where schedule_key = 'deliver_due_reminders:global:test-slot-1'
  ),
  1,
  'a successful job claim is not retried'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000051',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.complete_occurrence(
      (
        select occurrence.id
        from public.routine_occurrences as occurrence
        join public.routines as routine on routine.id = occurrence.routine_id
        where routine.title = 'Reminder cancellation routine'
          and occurrence.status = 'open'
          and occurrence.role = 'current'
      ),
      'notify-complete-reminder',
      (timezone('Europe/Zurich', now()))::date
    )
  $$,
  'completing an occurrence with a delivered reminder succeeds'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.inbox_notifications
    where kind = 'routine_reminder'
      and dedupe_key like 'reminder:%'
  ),
  0,
  'completing an occurrence deletes its unread inbox reminder'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000051',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.create_routine(
      p_household_id => '10000000-0000-4000-8000-000000000051',
      p_title => 'Shared reschedule routine',
      p_area_id => (
        select id
        from public.areas
        where household_id = '10000000-0000-4000-8000-000000000051'
          and name = 'General'
      ),
      p_assignment_policy => 'shared',
      p_schedule_kind => 'one_off',
      p_schedule_rule => jsonb_build_object(
        'kind',
        'one_off',
        'date',
        (timezone('Europe/Zurich', now()))::date
      ),
      p_active_from => (timezone('Europe/Zurich', now()))::date,
      p_active_until => (timezone('Europe/Zurich', now()))::date + 14
    )
  $$,
  'a member can create a shared routine for reschedule notices'
);

select lives_ok(
  $$
    select public.reschedule_occurrence(
      (
        select occurrence.id
        from public.routine_occurrences as occurrence
        join public.routines as routine on routine.id = occurrence.routine_id
        where routine.title = 'Shared reschedule routine'
          and occurrence.status = 'open'
          and occurrence.role = 'current'
      ),
      (timezone('Europe/Zurich', now()))::date + 1,
      'notify-shared-reschedule-1'
    )
  $$,
  'rescheduling a shared occurrence succeeds'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.inbox_notifications
    where household_id = '10000000-0000-4000-8000-000000000051'
      and recipient_member_id = '00000000-0000-4000-8000-000000000052'
      and activity_kind = 'occurrence_rescheduled'
  ),
  1,
  'rescheduling a shared occurrence notifies the other member'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000051',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.create_routine(
      p_household_id => '10000000-0000-4000-8000-000000000051',
      p_title => 'Repeated update routine',
      p_area_id => (
        select id
        from public.areas
        where household_id = '10000000-0000-4000-8000-000000000051'
          and name = 'General'
      ),
      p_assignment_policy => 'assigned',
      p_schedule_kind => 'one_off',
      p_schedule_rule => jsonb_build_object(
        'kind',
        'one_off',
        'date',
        (timezone('Europe/Zurich', now()))::date + 2
      ),
      p_assigned_member_id => '00000000-0000-4000-8000-000000000052',
      p_active_from => (timezone('Europe/Zurich', now()))::date,
      p_active_until => (timezone('Europe/Zurich', now()))::date + 30
    )
  $$,
  'a member can create a routine for repeated update notices'
);

select lives_ok(
  $$
    select public.edit_routine_definition(
      p_routine_id => (
        select id
        from public.routines
        where title = 'Repeated update routine'
      ),
      p_expected_updated_at => (select updated_at from public.routines where id = (
        select id
        from public.routines
        where title = 'Repeated update routine'
      )),
      p_idempotency_key => '005-edit-1',
      p_patch => jsonb_build_object('schedule_rule', jsonb_build_object(
        'kind',
        'one_off',
        'date',
        (timezone('Europe/Zurich', now()))::date + 3
      ))
    )
  $$,
  'first schedule update succeeds'
);

select lives_ok(
  $$
    select public.edit_routine_definition(
      p_routine_id => (
        select id
        from public.routines
        where title = 'Repeated update routine'
      ),
      p_expected_updated_at => (select updated_at from public.routines where id = (
        select id
        from public.routines
        where title = 'Repeated update routine'
      )),
      p_idempotency_key => '005-edit-2',
      p_patch => jsonb_build_object('schedule_rule', jsonb_build_object(
        'kind',
        'one_off',
        'date',
        (timezone('Europe/Zurich', now()))::date + 4
      ))
    )
  $$,
  'second schedule update succeeds'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.inbox_notifications
    where household_id = '10000000-0000-4000-8000-000000000051'
      and recipient_member_id = '00000000-0000-4000-8000-000000000052'
      and activity_kind = 'routine_updated'
      and entity_id = (
        select id
        from public.routines
        where title = 'Repeated update routine'
      )
  ),
  2,
  'later routine updates keep creating partner notices'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000051',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.create_routine(
      p_household_id => '10000000-0000-4000-8000-000000000051',
      p_title => 'Reschedule clears reminder',
      p_area_id => (
        select id
        from public.areas
        where household_id = '10000000-0000-4000-8000-000000000051'
          and name = 'General'
      ),
      p_assignment_policy => 'assigned',
      p_schedule_kind => 'one_off',
      p_schedule_rule => jsonb_build_object(
        'kind',
        'one_off',
        'date',
        (timezone('Europe/Zurich', now()))::date
      ),
      p_assigned_member_id => '00000000-0000-4000-8000-000000000052',
      p_active_from => (timezone('Europe/Zurich', now()))::date,
      p_active_until => (timezone('Europe/Zurich', now()))::date + 14
    )
  $$,
  'a member can create a routine whose reminder is cleared by reschedule'
);

reset role;

insert into public.routine_reminder_preferences (
  routine_id,
  member_id,
  household_id,
  enabled,
  due_day_local_time
)
select
  routine.id,
  '00000000-0000-4000-8000-000000000052',
  routine.household_id,
  true,
  '00:00'::time
from public.routines as routine
where routine.title = 'Reschedule clears reminder';

set local role service_role;

select is(
  public.run_deliver_due_reminders(
    'deliver_due_reminders:global:test-slot-reschedule-clear',
    100
  ) ->> 'decision',
  'run',
  'the reminder runner delivers a candidate before reschedule'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.inbox_notifications
    where kind = 'routine_reminder'
      and recipient_member_id = '00000000-0000-4000-8000-000000000052'
      and entity_id = (
        select occurrence.id
        from public.routine_occurrences as occurrence
        join public.routines as routine on routine.id = occurrence.routine_id
        where routine.title = 'Reschedule clears reminder'
          and occurrence.status = 'open'
          and occurrence.role = 'current'
      )
  ),
  1,
  'reschedule target has a delivered inbox reminder'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000051',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.reschedule_occurrence(
      (
        select occurrence.id
        from public.routine_occurrences as occurrence
        join public.routines as routine on routine.id = occurrence.routine_id
        where routine.title = 'Reschedule clears reminder'
          and occurrence.status = 'open'
          and occurrence.role = 'current'
      ),
      (timezone('Europe/Zurich', now()))::date + 2,
      'notify-reschedule-clear-reminder'
    )
  $$,
  'rescheduling after reminder delivery succeeds'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.inbox_notifications
    where kind = 'routine_reminder'
      and dedupe_key = (
        'reminder:' || (
          select occurrence.id::text
          from public.routine_occurrences as occurrence
          join public.routines as routine on routine.id = occurrence.routine_id
          where routine.title = 'Reschedule clears reminder'
            and occurrence.status = 'open'
            and occurrence.role = 'current'
        )
      )
  ),
  0,
  'rescheduling deletes the unread inbox reminder for the occurrence'
);

set local role service_role;

select is(
  public.run_drain_push_outbox(
    'drain_push_outbox:global:test-slot-1',
    50
  ) ->> 'decision',
  'run',
  'the push outbox drain runner claims its schedule key'
);

select is(
  public.run_drain_push_outbox(
    'drain_push_outbox:global:test-slot-1',
    50
  ) ->> 'decision',
  'already_succeeded',
  'replaying the push outbox drain schedule key returns the completed claim'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000052',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    public.mark_inbox_notifications_read(
      array[
        (
          select id
          from public.inbox_notifications
          where activity_kind = 'expense_posted'
          limit 1
        )
      ]
    ) ->> 'marked'
  )::integer,
  1,
  'the recipient can mark their inbox notification read'
);

reset role;

select * from finish();
rollback;
