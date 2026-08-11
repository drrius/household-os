begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

select has_table('public', 'expense_categories', 'expense categories table exists');
select has_table('public', 'financial_events', 'financial events table exists');
select has_table(
  'public',
  'financial_allocations',
  'financial allocations table exists'
);
select has_table('public', 'ledger_entries', 'ledger entries table exists');
select has_table(
  'public',
  'recurring_expense_rules',
  'recurring expense rules table exists'
);
select has_table(
  'public',
  'money_command_receipts',
  'money command receipts table exists'
);

select has_function(
  'public',
  'establish_opening_balance',
  'establish_opening_balance exists'
);
select has_function(
  'public',
  'post_manual_expense',
  'post_manual_expense exists'
);
select has_function(
  'public',
  'confirm_expense_draft',
  'confirm_expense_draft exists'
);
select has_function(
  'public',
  'dismiss_expense_draft',
  'dismiss_expense_draft exists'
);
select has_function('public', 'post_refund', 'post_refund exists');
select has_function('public', 'record_settlement', 'record_settlement exists');
select has_function(
  'public',
  'correct_financial_event',
  'correct_financial_event exists'
);
select has_function(
  'public',
  'create_recurring_expense_rule',
  'create_recurring_expense_rule exists'
);
select has_function(
  'public',
  'set_recurring_expense_rule_active',
  'set_recurring_expense_rule_active exists'
);
select has_function(
  'public',
  'generate_due_recurring_drafts',
  'generate_due_recurring_drafts exists'
);

select ok(
  (
    select count(*) = 6 and bool_and(relrowsecurity)
    from pg_class
    where oid in (
      'public.expense_categories'::regclass,
      'public.financial_events'::regclass,
      'public.financial_allocations'::regclass,
      'public.ledger_entries'::regclass,
      'public.recurring_expense_rules'::regclass,
      'public.money_command_receipts'::regclass
    )
  ),
  'RLS is enabled on every money table'
);

select ok(
  (
    select count(distinct tablename) = 6
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'expense_categories',
        'financial_events',
        'financial_allocations',
        'ledger_entries',
        'recurring_expense_rules',
        'money_command_receipts'
      )
  ),
  'every money table has an RLS policy'
);

select col_is_pk(
  'public',
  'money_command_receipts',
  array['household_id', 'idempotency_key'],
  'money receipts serialize one result per household key'
);

select ok(
  not exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'establish_opening_balance',
        'post_manual_expense',
        'confirm_expense_draft',
        'dismiss_expense_draft',
        'post_refund',
        'record_settlement',
        'correct_financial_event',
        'create_recurring_expense_rule',
        'set_recurring_expense_rule_active',
        'generate_due_recurring_drafts'
      )
      and has_function_privilege('anon', pg_proc.oid, 'execute')
  ),
  'anonymous clients cannot execute money RPCs'
);

select is(
  (
    select count(*)::integer
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'establish_opening_balance',
        'post_manual_expense',
        'confirm_expense_draft',
        'dismiss_expense_draft',
        'post_refund',
        'record_settlement',
        'correct_financial_event',
        'create_recurring_expense_rule',
        'set_recurring_expense_rule_active',
        'generate_due_recurring_drafts'
      )
      and has_function_privilege('authenticated', pg_proc.oid, 'execute')
  ),
  10,
  'authenticated clients can execute every money RPC'
);

select ok(
  not has_table_privilege('authenticated', 'public.financial_events', 'insert')
    and not has_table_privilege(
      'authenticated',
      'public.financial_events',
      'update'
    )
    and not has_table_privilege(
      'authenticated',
      'public.financial_events',
      'delete'
    ),
  'authenticated clients cannot mutate financial events directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.ledger_entries', 'insert')
    and not has_table_privilege(
      'authenticated',
      'public.ledger_entries',
      'update'
    )
    and not has_table_privilege(
      'authenticated',
      'public.ledger_entries',
      'delete'
    ),
  'authenticated clients cannot mutate ledger entries directly'
);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000041', 'money-one@example.invalid'),
  ('00000000-0000-4000-8000-000000000042', 'money-two@example.invalid'),
  ('00000000-0000-4000-8000-000000000043', 'money-other-one@example.invalid'),
  ('00000000-0000-4000-8000-000000000044', 'money-other-two@example.invalid'),
  ('00000000-0000-4000-8000-000000000045', 'money-outsider@example.invalid');

insert into public.households (id, name)
values
  ('10000000-0000-4000-8000-000000000041', 'Money household one'),
  ('10000000-0000-4000-8000-000000000042', 'Money household two');

insert into public.household_members (household_id, user_id, display_name)
values
  (
    '10000000-0000-4000-8000-000000000041',
    '00000000-0000-4000-8000-000000000041',
    'Money Member One'
  ),
  (
    '10000000-0000-4000-8000-000000000041',
    '00000000-0000-4000-8000-000000000042',
    'Money Member Two'
  ),
  (
    '10000000-0000-4000-8000-000000000042',
    '00000000-0000-4000-8000-000000000043',
    'Money Other One'
  ),
  (
    '10000000-0000-4000-8000-000000000042',
    '00000000-0000-4000-8000-000000000044',
    'Money Other Two'
  );

select is(
  (
    select count(*)::integer
    from public.expense_categories
    where household_id = '10000000-0000-4000-8000-000000000041'
  ),
  7,
  'a new household receives seven default expense categories'
);

select results_eq(
  $$
    select name, sort_order
    from public.expense_categories
    where household_id = '10000000-0000-4000-8000-000000000041'
    order by sort_order
  $$,
  $$
    values
      ('Groceries'::text, 1),
      ('Dining'::text, 2),
      ('Home'::text, 3),
      ('Pet'::text, 4),
      ('Utilities'::text, 5),
      ('Rent'::text, 6),
      ('Other'::text, 7)
  $$,
  'default expense categories have the product-defined order'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000041',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*)::integer from public.expense_categories),
  7,
  'members read only their household expense categories'
);

select throws_ok(
  $$
    select public.establish_opening_balance(
      '10000000-0000-4000-8000-000000000042',
      '00000000-0000-4000-8000-000000000043',
      1000,
      '2030-08-01',
      'Denied opening',
      'money-cross-household'
    )
  $$,
  '42501',
  'caller is not a member of household 10000000-0000-4000-8000-000000000042',
  'money commands reject cross-household callers'
);

select lives_ok(
  $$
    select public.establish_opening_balance(
      '10000000-0000-4000-8000-000000000041',
      '00000000-0000-4000-8000-000000000041',
      2000,
      '2030-08-01',
      'Imported balance',
      'money-opening-1'
    )
  $$,
  'a member can establish an opening balance'
);

select results_eq(
  $$
    select member_id, receivable_delta_cents
    from public.ledger_entries
    where financial_event_id = (
      select id from public.financial_events where type = 'opening_balance'
    )
    order by member_id
  $$,
  $$
    values
      ('00000000-0000-4000-8000-000000000041'::uuid, 2000::bigint),
      ('00000000-0000-4000-8000-000000000042'::uuid, -2000::bigint)
  $$,
  'opening balance credits the owed member and debits the other member'
);

select throws_ok(
  $$
    select public.establish_opening_balance(
      '10000000-0000-4000-8000-000000000041',
      '00000000-0000-4000-8000-000000000041',
      10,
      '2030-08-02',
      'Second opening',
      'money-opening-2'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "financial_events_one_opening_balance_idx"',
  'a household cannot establish a second opening balance'
);

select lives_ok(
  $$
    select public.post_manual_expense(
      p_household_id => '10000000-0000-4000-8000-000000000041',
      p_description => 'Odd-cent groceries',
      p_amount_cents => 1001,
      p_payer_member_id => '00000000-0000-4000-8000-000000000041',
      p_allocations => '[
        {"memberId":"00000000-0000-4000-8000-000000000041","allocatedCents":501},
        {"memberId":"00000000-0000-4000-8000-000000000042","allocatedCents":500}
      ]',
      p_occurred_on => '2030-08-03',
      p_idempotency_key => 'money-expense-odd'
    )
  $$,
  'an exact odd-cent expense posts'
);

select results_eq(
  $$
    select member_id, receivable_delta_cents
    from public.ledger_entries
    where financial_event_id = (
      select id
      from public.financial_events
      where description = 'Odd-cent groceries'
    )
    order by member_id
  $$,
  $$
    values
      ('00000000-0000-4000-8000-000000000041'::uuid, 500::bigint),
      ('00000000-0000-4000-8000-000000000042'::uuid, -500::bigint)
  $$,
  '1001 centimes split 501/500 produces the frozen ledger projection'
);

select results_eq(
  $$
    select member_id, sum(receivable_delta_cents)::bigint
    from public.ledger_entries
    group by member_id
    order by member_id
  $$,
  $$
    values
      ('00000000-0000-4000-8000-000000000041'::uuid, 2500::bigint),
      ('00000000-0000-4000-8000-000000000042'::uuid, -2500::bigint)
  $$,
  'member balances are derived from ledger entry sums'
);

select throws_ok(
  $$
    select public.post_manual_expense(
      p_household_id => '10000000-0000-4000-8000-000000000041',
      p_description => 'Bad allocation',
      p_amount_cents => 1000,
      p_payer_member_id => '00000000-0000-4000-8000-000000000041',
      p_allocations => '[
        {"memberId":"00000000-0000-4000-8000-000000000041","allocatedCents":500},
        {"memberId":"00000000-0000-4000-8000-000000000042","allocatedCents":499}
      ]',
      p_occurred_on => '2030-08-04',
      p_idempotency_key => 'money-expense-bad'
    )
  $$,
  '23514',
  'allocation total must equal amount_cents',
  'allocation totals must exactly match the event amount'
);

reset role;

insert into public.expense_drafts (
  id,
  household_id,
  source_kind,
  description,
  amount_cents,
  payer_member_id,
  proposed_allocations,
  occurred_on
)
values (
  '20000000-0000-4000-8000-000000000041',
  '10000000-0000-4000-8000-000000000041',
  'recurring',
  'Draft expense',
  1002,
  '00000000-0000-4000-8000-000000000042',
  '[
    {"memberId":"00000000-0000-4000-8000-000000000041","allocatedCents":501},
    {"memberId":"00000000-0000-4000-8000-000000000042","allocatedCents":501}
  ]',
  '2030-08-05'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000041',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.confirm_expense_draft(
      '20000000-0000-4000-8000-000000000041',
      'money-confirm-draft'
    )
  $$,
  'a pending expense draft can be confirmed'
);

select lives_ok(
  $$
    select public.confirm_expense_draft(
      '20000000-0000-4000-8000-000000000041',
      'money-confirm-draft'
    )
  $$,
  'a same-key draft confirmation returns the stored result'
);

select is(
  (
    select count(*)::integer
    from public.financial_events
    where expense_draft_id = '20000000-0000-4000-8000-000000000041'
  ),
  1,
  'a same-key draft confirmation posts one event'
);

select is(
  (
    select status
    from public.expense_drafts
    where id = '20000000-0000-4000-8000-000000000041'
  ),
  'posted',
  'confirming a draft marks it posted'
);

select throws_ok(
  $$
    select public.confirm_expense_draft(
      p_draft_id => '20000000-0000-4000-8000-000000000041',
      p_idempotency_key => 'money-confirm-draft',
      p_amount_cents => 1003
    )
  $$,
  '22023',
  'idempotency key was already used for a different command',
  'a different payload cannot reuse a money idempotency key'
);

select lives_ok(
  $$
    select public.post_refund(
      p_related_event_id => (
        select id
        from public.financial_events
        where description = 'Odd-cent groceries'
      ),
      p_amount_cents => 201,
      p_allocations => '[
        {"memberId":"00000000-0000-4000-8000-000000000041","allocatedCents":101},
        {"memberId":"00000000-0000-4000-8000-000000000042","allocatedCents":100}
      ]',
      p_occurred_on => '2030-08-06',
      p_idempotency_key => 'money-refund-1',
      p_description => 'Grocery refund'
    )
  $$,
  'a refund posts the inverse expense projection'
);

select results_eq(
  $$
    select member_id, receivable_delta_cents
    from public.ledger_entries
    where financial_event_id = (
      select id from public.financial_events where description = 'Grocery refund'
    )
    order by member_id
  $$,
  $$
    values
      ('00000000-0000-4000-8000-000000000041'::uuid, -100::bigint),
      ('00000000-0000-4000-8000-000000000042'::uuid, 100::bigint)
  $$,
  'refund entries invert the expense-like projection'
);

select lives_ok(
  $$
    select public.record_settlement(
      '10000000-0000-4000-8000-000000000041',
      '00000000-0000-4000-8000-000000000042',
      400,
      '2030-08-07',
      'External transfer',
      'money-settlement-1'
    )
  $$,
  'a member can record an external settlement'
);

select lives_ok(
  $$
    select public.correct_financial_event(
      p_event_id => (
        select id
        from public.financial_events
        where description = 'Odd-cent groceries'
      ),
      p_idempotency_key => 'money-correction-1',
      p_replacement => '{
        "description":"Corrected groceries",
        "amount_cents":1200,
        "payer_member_id":"00000000-0000-4000-8000-000000000041",
        "allocations":[
          {"memberId":"00000000-0000-4000-8000-000000000041","allocatedCents":600},
          {"memberId":"00000000-0000-4000-8000-000000000042","allocatedCents":600}
        ],
        "occurred_on":"2030-08-03"
      }'
    )
  $$,
  'a correction atomically posts a reversal and replacement'
);

select is(
  (
    select count(*)::integer
    from public.financial_events
    where related_event_id = (
      select id
      from public.financial_events
      where description = 'Odd-cent groceries'
    )
      and type in ('reversal', 'replacement')
  ),
  2,
  'correction preserves both reversal and replacement events'
);

select ok(
  not exists (
    select financial_event_id
    from public.ledger_entries
    group by financial_event_id
    having sum(receivable_delta_cents) <> 0
  ),
  'refund, settlement, reversal, replacement, and all other events are zero-sum'
);

select lives_ok(
  $$
    select public.create_recurring_expense_rule(
      p_household_id => '10000000-0000-4000-8000-000000000041',
      p_description => 'Weekly rent contribution',
      p_amount_cents => 1000,
      p_payer_member_id => '00000000-0000-4000-8000-000000000041',
      p_allocations => '[
        {"memberId":"00000000-0000-4000-8000-000000000041","allocatedCents":500},
        {"memberId":"00000000-0000-4000-8000-000000000042","allocatedCents":500}
      ]',
      p_schedule_kind => 'weekly',
      p_next_occurrence_on => '2030-08-12',
      p_idempotency_key => 'money-rule-1',
      p_iso_weekday => 1
    )
  $$,
  'a member can create a weekly recurring expense rule'
);

select is(
  (select count(*)::integer from public.financial_events),
  (
    select count(*)::integer
    from public.financial_events
  ),
  'financial event baseline is available before draft generation'
);

create temporary table money_event_baseline as
select count(*)::integer as event_count
from public.financial_events;

select lives_ok(
  $$
    select public.generate_due_recurring_drafts(
      '10000000-0000-4000-8000-000000000041',
      '2030-08-26',
      'money-generate-1'
    )
  $$,
  'due recurring rules generate drafts'
);

select is(
  (
    select count(*)::integer
    from public.expense_drafts
    where recurring_expense_rule_id is not null
  ),
  3,
  'recurring generation creates one draft for each due weekly occurrence'
);

select is(
  (select count(*)::integer from public.financial_events),
  (select event_count from money_event_baseline),
  'recurring generation never posts financial events'
);

select lives_ok(
  $$
    select public.generate_due_recurring_drafts(
      '10000000-0000-4000-8000-000000000041',
      '2030-08-26',
      'money-generate-1'
    )
  $$,
  'a same-key recurring generation returns its stored result'
);

select is(
  (
    select count(*)::integer
    from public.expense_drafts
    where recurring_expense_rule_id is not null
  ),
  3,
  'recurring generation is idempotent'
);

reset role;

insert into public.financial_events (
  id,
  household_id,
  type,
  occurred_on,
  created_by_member_id,
  payer_member_id,
  description,
  amount_cents
)
values (
  '30000000-0000-4000-8000-000000000041',
  '10000000-0000-4000-8000-000000000041',
  'settlement',
  '2030-08-30',
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000041',
  'Zero-sum trigger probe',
  10
);

select throws_ok(
  $$
    insert into public.ledger_entries (
      household_id,
      financial_event_id,
      member_id,
      receivable_delta_cents
    )
    values (
      '10000000-0000-4000-8000-000000000041',
      '30000000-0000-4000-8000-000000000041',
      '00000000-0000-4000-8000-000000000041',
      10
    )
  $$,
  '23514',
  'ledger entries for event 30000000-0000-4000-8000-000000000041 must sum to zero',
  'the ledger trigger rejects an unbalanced insert statement'
);

select ok(
  (
    select count(*) >= 8
    from public.activity_events
    where household_id = '10000000-0000-4000-8000-000000000041'
      and kind in (
        'opening_balance_established',
        'expense_posted',
        'expense_draft_confirmed',
        'refund_posted',
        'settlement_recorded',
        'financial_event_corrected',
        'recurring_expense_rule_created',
        'recurring_drafts_generated'
      )
  ),
  'financial mutations write durable activity events'
);

select * from finish();
rollback;
