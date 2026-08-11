begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

select has_table('public', 'inbox_notifications', 'inbox table exists');
select has_table(
  'public',
  'notification_digest_preferences',
  'digest preferences table exists'
);
select has_table('public', 'push_subscriptions', 'push subscriptions table exists');
select has_table('public', 'push_outbox', 'push outbox table exists');
select has_table('public', 'job_claims', 'job claims table exists');

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
  'RLS is enabled on every notification table'
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
        'run_generate_recurring_drafts_cron'
      )
      and has_function_privilege('anon', pg_proc.oid, 'execute')
  ),
  'anonymous clients cannot execute notification RPCs'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.upsert_digest_preference(boolean, time)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.mark_inbox_notifications_read(uuid[])',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.run_deliver_due_reminders(text, integer)',
    'execute'
  ),
  'authenticated members get prefs/inbox RPCs but not Cron runners'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.run_deliver_due_reminders(text, integer)',
    'execute'
  )
  and has_function_privilege(
    'service_role',
    'public.run_deliver_member_digests(text, time, integer)',
    'execute'
  ),
  'service_role can execute Cron notification runners'
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
    select public.establish_opening_balance(
      '10000000-0000-4000-8000-000000000051',
      '00000000-0000-4000-8000-000000000051',
      1000,
      current_date,
      'Opening',
      'notify-opening-1',
      null
    )
  $$,
  'member one can establish an opening balance'
);

select is(
  (
    select count(*)::integer
    from public.inbox_notifications
    where household_id = '10000000-0000-4000-8000-000000000051'
      and recipient_member_id = '00000000-0000-4000-8000-000000000052'
      and kind = 'partner_notice'
      and activity_kind = 'opening_balance_established'
  ),
  1,
  'partner receives an inbox notice for the opening balance'
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
  'actor is not notified of their own financial mutation'
);

select is(
  (
    select status
    from public.push_outbox
    where household_id = '10000000-0000-4000-8000-000000000051'
    order by created_at
    limit 1
  ),
  'skipped_no_subscription',
  'declined push leaves inbox durable and marks outbox skipped'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000053',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.inbox_notifications
  ),
  0,
  'cross-household members cannot read another household inbox'
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
    select (public.upsert_digest_preference(true, '08:00'::time) ->> 'enabled')::boolean
  ),
  true,
  'member two can upsert digest preferences'
);

reset role;
set local role service_role;

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
  'Pending draft',
  500,
  '00000000-0000-4000-8000-000000000051',
  '[]'::jsonb,
  current_date,
  'pending'
);

select ok(
  (
    select public.run_deliver_member_digests(
      'deliver_member_digests:global:test-slot-1',
      '08:00'::time,
      50
    ) ->> 'decision' = 'run'
  ),
  'digest job runs for the configured slot'
);

select ok(
  (
    select payload
    from public.inbox_notifications
    where kind = 'household_digest'
      and recipient_member_id = '00000000-0000-4000-8000-000000000052'
    limit 1
  )
  ? 'pendingFinancialDrafts'
  and not (
    (
      select payload
      from public.inbox_notifications
      where kind = 'household_digest'
        and recipient_member_id = '00000000-0000-4000-8000-000000000052'
      limit 1
    )
    ? 'owedBalanceCents'
  )
  and not (
    (
      select payload::text
      from public.inbox_notifications
      where kind = 'household_digest'
        and recipient_member_id = '00000000-0000-4000-8000-000000000052'
      limit 1
    )
    ilike '%owed%'
  ),
  'digest payload includes drafts and omits owed balances'
);

select is(
  (
    select public.run_deliver_member_digests(
      'deliver_member_digests:global:test-slot-1',
      '08:00'::time,
      50
    ) ->> 'decision'
  ),
  'already_succeeded',
  'digest job claim is idempotent for the same schedule key'
);

select is(
  (
    select count(*)::integer
    from public.inbox_notifications
    where kind = 'household_digest'
      and recipient_member_id = '00000000-0000-4000-8000-000000000052'
  ),
  1,
  'retrying the digest job does not duplicate inbox rows'
);

reset role;

select * from finish();
rollback;
