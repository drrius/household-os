begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select ok(not has_function_privilege('anon', 'public.update_recurring_expense_rule(uuid,text,bigint,uuid,jsonb,text,date,text,integer,integer,uuid)', 'EXECUTE'), 'anonymous clients cannot edit recurring rules');
select ok(has_function_privilege('authenticated', 'public.update_recurring_expense_rule(uuid,text,bigint,uuid,jsonb,text,date,text,integer,integer,uuid)', 'EXECUTE'), 'authenticated members can call the authorized edit command');

insert into auth.users (id, email) values
('00000000-0000-4000-8000-000000000121', 'refund-one@example.invalid'),
('00000000-0000-4000-8000-000000000122', 'refund-two@example.invalid'),
('00000000-0000-4000-8000-000000000123', 'refund-outsider@example.invalid');
insert into public.households (id, name) values ('10000000-0000-4000-8000-000000000121', 'Refund limits');
insert into public.household_members (household_id, user_id, display_name) values
('10000000-0000-4000-8000-000000000121', '00000000-0000-4000-8000-000000000121', 'Alex'),
('10000000-0000-4000-8000-000000000121', '00000000-0000-4000-8000-000000000122', 'Sam');
create function pg_temp.shares(a bigint, b bigint) returns jsonb language sql as $$
select jsonb_build_array(jsonb_build_object('memberId', '00000000-0000-4000-8000-000000000121', 'allocatedCents', a), jsonb_build_object('memberId', '00000000-0000-4000-8000-000000000122', 'allocatedCents', b))
$$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000121', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.establish_opening_balance('10000000-0000-4000-8000-000000000121', '00000000-0000-4000-8000-000000000121', 0, '2030-01-01', 'Opening', 'refund-opening');
select set_config('test.expense', (public.post_manual_expense('10000000-0000-4000-8000-000000000121', 'Original', 1001, '00000000-0000-4000-8000-000000000121', pg_temp.shares(501,500), '2030-01-01', 'refund-source')->>'financial_event_id'), true);
select set_config('test.refund', (public.post_refund(current_setting('test.expense')::uuid, 501, pg_temp.shares(501,0), '2030-01-02', 'refund-first', 'First refund')->>'financial_event_id'), true);
select is(public.post_refund(current_setting('test.expense')::uuid, 501, pg_temp.shares(501,0), '2030-01-02', 'refund-first', 'First refund')->>'financial_event_id', current_setting('test.refund'), 'same-key retry succeeds after its share is exhausted');
select throws_ok($$select public.post_refund(current_setting('test.expense')::uuid, 1, pg_temp.shares(1,0), '2030-01-02', 'refund-excess-share', 'Too much')$$, '23514', 'Refund shares exceed the remaining refundable shares. Refresh this expense.', 'cannot exceed one share even while the total has room');
select throws_ok($$select public.post_refund(current_setting('test.expense')::uuid, 501, pg_temp.shares(0,501), '2030-01-02', 'refund-excess-total', 'Too much')$$, '23514', 'Refund shares exceed the remaining refundable shares. Refresh this expense.', 'cannot refund more than the remaining total');
select throws_ok($$select public.correct_financial_event(current_setting('test.expense')::uuid, 'refund-block-correction')$$, '55000', 'Reverse the active refunds before correcting this expense.', 'an expense with an active refund cannot be corrected');
select lives_ok($$select public.correct_financial_event(current_setting('test.refund')::uuid, 'refund-reversal')$$, 'a refund can be reversed');
select lives_ok($$select public.correct_financial_event(current_setting('test.refund')::uuid, 'refund-reversal')$$, 'refund reversal retry is idempotent');
select set_config('test.refund2', (public.post_refund(current_setting('test.expense')::uuid, 1001, pg_temp.shares(501,500), '2030-01-03', 'refund-full', 'Full refund')->>'financial_event_id'), true);
select is((select count(*)::integer from public.financial_events where type='refund'), 2, 'reversing a refund releases its shares for a full refund');
select public.correct_financial_event(current_setting('test.refund2')::uuid, 'refund-full-reversal');
select set_config('test.replacement', (public.correct_financial_event(current_setting('test.expense')::uuid, 'refund-replace', jsonb_build_object('description','Replacement','amount_cents',600,'payer_member_id','00000000-0000-4000-8000-000000000121','allocations',pg_temp.shares(300,300),'occurred_on','2030-01-01'))->>'replacement_event_id'), true);
select throws_ok($$select public.post_refund(current_setting('test.expense')::uuid, 1, pg_temp.shares(1,0), '2030-01-04', 'refund-old-source', 'Old source')$$, '55000', 'This expense has been reversed. Refund its replacement instead.', 'cannot refund a reversed source');
select lives_ok($$select public.post_refund(current_setting('test.replacement')::uuid, 600, pg_temp.shares(300,300), '2030-01-04', 'refund-replacement', 'Replacement refund')$$, 'the replacement has its own refundable shares');
select ok(not exists(select financial_event_id from public.ledger_entries group by financial_event_id having sum(receivable_delta_cents)<>0), 'all refund and correction entries stay zero-sum');
select is((select count(*)::integer from public.financial_allocations where financial_event_id=current_setting('test.expense')::uuid and allocated_cents in (501,500)), 2, 'original allocations stay immutable');

-- Opening balances form one append-only lineage. Reversal-only can be repaired later.
select set_config('test.opening', (select id::text from public.financial_events where type='opening_balance'), true);
create function pg_temp.opening_payload(amount bigint, creditor uuid default '00000000-0000-4000-8000-000000000122') returns jsonb language sql as $$
select jsonb_build_object('description','Corrected starting balance','amount_cents',amount,'payer_member_id',creditor,'occurred_on','2030-01-01','note','Agreed correction')
$$;
reset role;
select throws_ok($$insert into public.financial_events (household_id,type,occurred_on,created_by_member_id,payer_member_id,description,amount_cents,related_event_id) values ('10000000-0000-4000-8000-000000000121','opening_balance','2030-01-01','00000000-0000-4000-8000-000000000121','00000000-0000-4000-8000-000000000121','Invalid source',100,current_setting('test.expense')::uuid)$$, '23514', 'opening corrections require a reversed opening balance parent', 'opening successors cannot attach to expenses');
select throws_ok($$insert into public.financial_events (household_id,type,occurred_on,created_by_member_id,payer_member_id,description,amount_cents,related_event_id) values ('10000000-0000-4000-8000-000000000121','opening_balance','2030-01-01','00000000-0000-4000-8000-000000000121','00000000-0000-4000-8000-000000000121','Unreversed source',100,current_setting('test.opening')::uuid)$$, '23514', 'opening corrections require a reversed opening balance parent', 'opening successors require the original effect to be reversed');
set local role authenticated;
select throws_ok($$select public.correct_financial_event(current_setting('test.opening')::uuid, 'opening-allocations', pg_temp.opening_payload(100) || jsonb_build_object('allocations', pg_temp.shares(50,50)))$$, '22023', 'opening balance corrections do not accept expense allocations', 'expense-shaped payload cannot change opening semantics');
select set_config('test.opening_child', (public.correct_financial_event(current_setting('test.opening')::uuid, 'opening-correct', pg_temp.opening_payload(12345))->>'replacement_event_id'), true);
select is(public.correct_financial_event(current_setting('test.opening')::uuid, 'opening-correct', pg_temp.opening_payload(12345))->>'replacement_event_id', current_setting('test.opening_child'), 'opening correction retry returns the same successor');
select is((select type from public.financial_events where id=current_setting('test.opening_child')::uuid), 'opening_balance', 'opening successor retains creditor semantics and is excluded from expense contexts');
select is((select related_event_id::text from public.financial_events where id=current_setting('test.opening_child')::uuid), current_setting('test.opening'), 'opening replacement links its original');
select is((select receivable_delta_cents from public.ledger_entries where financial_event_id=current_setting('test.opening_child')::uuid and member_id='00000000-0000-4000-8000-000000000122'), 12345::bigint, 'creditor receives the positive opening effect');
select is((select count(*)::integer from public.financial_allocations where financial_event_id=current_setting('test.opening_child')::uuid), 0, 'opening corrections have no expense allocations');
select throws_ok($$select public.correct_financial_event(current_setting('test.opening')::uuid, 'opening-fork', pg_temp.opening_payload(23456))$$, '55000', 'financial event has already been corrected', 'a competing stale correction cannot fork the root');
select throws_ok($$select public.correct_financial_event(current_setting('test.opening')::uuid, 'opening-correct', pg_temp.opening_payload(23456))$$, '22023', 'idempotency key was already used for a different command', 'same key cannot change opening correction payload');
select set_config('test.opening_reverse', (public.correct_financial_event(current_setting('test.opening_child')::uuid, 'opening-zero')->>'reversal_event_id'), true);
select set_config('test.opening_repair', (public.correct_financial_event(current_setting('test.opening_child')::uuid, 'opening-repair', pg_temp.opening_payload(555, '00000000-0000-4000-8000-000000000121'))->>'replacement_event_id'), true);
select is((select count(*)::integer from public.financial_events where related_event_id=current_setting('test.opening_child')::uuid and type='reversal'), 1, 'repair never adds a second reversal');
select is(public.correct_financial_event(current_setting('test.opening_child')::uuid, 'opening-repair', pg_temp.opening_payload(555, '00000000-0000-4000-8000-000000000121'))->>'reversal_event_id', current_setting('test.opening_reverse'), 'repair retry retains the existing reversal');
select throws_ok($$select public.correct_financial_event(current_setting('test.opening_child')::uuid, 'opening-repair-fork', pg_temp.opening_payload(23456))$$, '55000', 'financial event has already been corrected', 'a repaired ancestor cannot reactivate');
select throws_ok($$select public.correct_financial_event(current_setting('test.opening_repair')::uuid, 'opening-bad-member', pg_temp.opening_payload(500, '00000000-0000-4000-8000-000000000123'))$$, '23503', null, 'correction cannot name an outside creditor');
select is((select count(*)::integer from public.financial_events where related_event_id=current_setting('test.opening_repair')::uuid), 0, 'failed replacement rolls back its reversal atomically');
select throws_ok($$select public.establish_opening_balance('10000000-0000-4000-8000-000000000121', '00000000-0000-4000-8000-000000000121', 1, '2030-01-01', 'Another root', 'opening-root-again')$$, '23505', null, 'a second original starting balance remains forbidden');
select throws_ok($$select public.post_refund(current_setting('test.opening_repair')::uuid, 1, pg_temp.shares(1,0), '2030-01-04', 'opening-refund', 'Invalid refund')$$, '22023', 'refunds must relate to an expense or replacement', 'opening successors never become refundable expenses');
select is((select count(*)::integer from public.financial_events where type='opening_balance' and related_event_id is null), 1, 'the original opening row remains unique and retained');
select ok(not exists(select financial_event_id from public.ledger_entries group by financial_event_id having sum(receivable_delta_cents)<>0), 'all opening correction and repair ledger events remain zero-sum');

select set_config('test.rule', (public.create_recurring_expense_rule('10000000-0000-4000-8000-000000000121', 'Rent', 1000, '00000000-0000-4000-8000-000000000121', pg_temp.shares(500,500), 'monthly', '2030-01-01', 'recurring-create', null, 1)->>'recurring_expense_rule_id'), true);
select public.generate_due_recurring_drafts('10000000-0000-4000-8000-000000000121', '2030-01-01', 'recurring-generate');
select public.set_recurring_expense_rule_active(current_setting('test.rule')::uuid, false, 'recurring-pause');
select lives_ok($$select public.update_recurring_expense_rule(current_setting('test.rule')::uuid, 'Updated rent', 1200, '00000000-0000-4000-8000-000000000122', pg_temp.shares(400,800), 'monthly', '2030-02-28', 'recurring-edit', null, 31)$$, 'a member can edit a monthly rule with month-end clamping');
select lives_ok($$select public.update_recurring_expense_rule(current_setting('test.rule')::uuid, 'Updated rent', 1200, '00000000-0000-4000-8000-000000000122', pg_temp.shares(400,800), 'monthly', '2030-02-28', 'recurring-edit', null, 31)$$, 'recurring edit retry is idempotent');
select is((select active from public.recurring_expense_rules where id=current_setting('test.rule')::uuid), false, 'editing retains the paused state');
select is((select amount_cents from public.expense_drafts where recurring_expense_rule_id=current_setting('test.rule')::uuid), 1000::bigint, 'existing drafts keep their original amount');
select is((select amount_cents from public.recurring_expense_rules where id=current_setting('test.rule')::uuid), 1200::bigint, 'future drafts use the edited amount');
select throws_ok($$select public.update_recurring_expense_rule(current_setting('test.rule')::uuid, 'Different payload', 1200, '00000000-0000-4000-8000-000000000122', pg_temp.shares(400,800), 'monthly', '2030-02-28', 'recurring-edit', null, 31)$$, '22023', 'idempotency key was already used for a different command', 'cannot change an edit payload while reusing its key');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000123', true);
select throws_ok($$select public.update_recurring_expense_rule(current_setting('test.rule')::uuid, 'Denied', 1200, '00000000-0000-4000-8000-000000000122', pg_temp.shares(400,800), 'monthly', '2030-02-28', 'recurring-unauthorized', null, 31)$$, '42501', 'caller is not a member of household 10000000-0000-4000-8000-000000000121', 'outsiders cannot edit another household rule');
select throws_ok($$select public.post_refund(current_setting('test.replacement')::uuid, 1, pg_temp.shares(1,0), '2030-01-04', 'refund-unauthorized', 'Denied')$$, '42501', 'caller is not a member of household 10000000-0000-4000-8000-000000000121', 'outsiders cannot refund another household event');
select throws_ok($$select public.correct_financial_event(current_setting('test.opening_repair')::uuid, 'opening-outsider', pg_temp.opening_payload(500))$$, '42501', 'caller is not a member of household 10000000-0000-4000-8000-000000000121', 'outsiders cannot correct opening balances');
select is((select count(*)::integer from public.financial_events), 0, 'RLS hides financial history from outsiders');
select * from finish();
rollback;
