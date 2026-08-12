begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000051', 'settle-one@example.invalid'),
  ('00000000-0000-4000-8000-000000000052', 'settle-two@example.invalid');

insert into public.households (id, name)
values ('10000000-0000-4000-8000-000000000051', 'Settlement lock household');

insert into public.household_members (household_id, user_id, display_name)
values
  (
    '10000000-0000-4000-8000-000000000051',
    '00000000-0000-4000-8000-000000000051',
    'Creditor'
  ),
  (
    '10000000-0000-4000-8000-000000000051',
    '00000000-0000-4000-8000-000000000052',
    'Debtor'
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
      '2030-09-01',
      'Imported balance',
      'settle-lock-opening'
    )
  $$,
  'opening balance creates an outstanding receivable'
);

select throws_ok(
  $$
    select public.record_settlement(
      '10000000-0000-4000-8000-000000000051',
      '00000000-0000-4000-8000-000000000051',
      1000,
      '2030-09-02',
      'Creditor cannot settle as payer',
      'settle-lock-wrong-payer',
      null,
      'full'
    )
  $$,
  '22023',
  'The named payer does not currently owe the outstanding balance.',
  'settlement rejects a payer who is not the current debtor'
);

select throws_ok(
  $$
    select public.record_settlement(
      '10000000-0000-4000-8000-000000000051',
      '00000000-0000-4000-8000-000000000052',
      1001,
      '2030-09-02',
      'Over-partial',
      'settle-lock-over-partial',
      null,
      'partial'
    )
  $$,
  '22023',
  'A partial settlement must be within the current balance.',
  'a partial settlement cannot exceed the locked outstanding amount'
);

select lives_ok(
  $$
    select public.record_settlement(
      '10000000-0000-4000-8000-000000000051',
      '00000000-0000-4000-8000-000000000052',
      400,
      '2030-09-02',
      'Partial transfer',
      'settle-lock-partial',
      null,
      'partial'
    )
  $$,
  'a partial settlement posts against the locked outstanding amount'
);

select lives_ok(
  $$
    select public.record_settlement(
      '10000000-0000-4000-8000-000000000051',
      '00000000-0000-4000-8000-000000000052',
      1000,
      '2030-09-03',
      'Stale full settle',
      'settle-lock-full',
      null,
      'full'
    )
  $$,
  'a full settlement derives the remaining locked amount, not the stale client amount'
);

select results_eq(
  $$
    select member_id, sum(receivable_delta_cents)::bigint
    from public.ledger_entries
    where household_id = '10000000-0000-4000-8000-000000000051'
    group by member_id
    order by member_id
  $$,
  $$
    values
      ('00000000-0000-4000-8000-000000000051'::uuid, 0::bigint),
      ('00000000-0000-4000-8000-000000000052'::uuid, 0::bigint)
  $$,
  'a derived full settlement zeros both member balances'
);

select is(
  (
    select amount_cents
    from public.financial_events
    where description = 'Stale full settle'
  ),
  600::bigint,
  'the posted full settlement uses the remaining 600 centimes'
);

select lives_ok(
  $$
    select public.record_settlement(
      '10000000-0000-4000-8000-000000000051',
      '00000000-0000-4000-8000-000000000052',
      1000,
      '2030-09-03',
      'Stale full settle',
      'settle-lock-full',
      null,
      'full'
    )
  $$,
  'a same-key full settlement retry returns the stored result'
);

select is(
  (
    select count(*)::integer
    from public.financial_events
    where household_id = '10000000-0000-4000-8000-000000000051'
      and type = 'settlement'
  ),
  2,
  'the full-settlement retry does not append a second settlement event'
);

select throws_ok(
  $$
    select public.record_settlement(
      '10000000-0000-4000-8000-000000000051',
      '00000000-0000-4000-8000-000000000052',
      1000,
      '2030-09-04',
      'Second full settle',
      'settle-lock-full-2',
      null,
      'full'
    )
  $$,
  '55000',
  'The household is already settled up.',
  'a second full settlement with a new idempotency key is rejected'
);

select * from finish();
rollback;
