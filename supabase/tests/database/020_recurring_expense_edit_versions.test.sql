begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000201','version-a@example.invalid'),
 ('00000000-0000-4000-8000-000000000202','version-b@example.invalid'),
 ('00000000-0000-4000-8000-000000000203','version-outsider@example.invalid');
insert into public.households(id,name) values ('10000000-0000-4000-8000-000000000201','Recurring versions');
insert into public.household_members(household_id,user_id,display_name) values
 ('10000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000201','A'),
 ('10000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000202','B');
create function pg_temp.version_shares() returns jsonb language sql as $$
 select '[{"memberId":"00000000-0000-4000-8000-000000000201","allocatedCents":500},{"memberId":"00000000-0000-4000-8000-000000000202","allocatedCents":500}]'::jsonb
$$;
create function pg_temp.edit_versioned_rule(version timestamptz, command_key text, label text default 'Updated rule') returns jsonb language sql as $$
 select public.update_recurring_expense_rule(current_setting('test.version_rule')::uuid, version, label, 1000, '00000000-0000-4000-8000-000000000201', pg_temp.version_shares(), 'monthly', '2030-02-01', command_key, null, 1)
$$;
create function pg_temp.fail_recurring_activity() returns trigger language plpgsql as $$
begin
 if new.kind='recurring_expense_rule_updated' and current_setting('test.fail_recurring_activity',true)='on' then
  raise exception 'test failure after rule mutation' using errcode='P0001';
 end if;
 return new;
end;
$$;
create trigger test_fail_recurring_activity before insert on public.activity_events for each row execute function pg_temp.fail_recurring_activity();
select ok(not has_function_privilege('authenticated','public.update_recurring_expense_rule(uuid,text,bigint,uuid,jsonb,text,date,text,integer,integer,uuid)','EXECUTE'),'old no-version overload is unavailable to API callers');
select ok(not has_function_privilege('anon','public.update_recurring_expense_rule(uuid,timestamptz,text,bigint,uuid,jsonb,text,date,text,integer,integer,uuid)','EXECUTE'),'anonymous versioned edits are unavailable');
select ok(not has_column_privilege('authenticated','public.recurring_expense_rules','description','UPDATE'),'direct edits cannot bypass the command');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
set local role authenticated;
select public.establish_opening_balance('10000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000201',0,'2030-01-01','Opening','version-opening');
select set_config('test.version_rule',public.create_recurring_expense_rule('10000000-0000-4000-8000-000000000201','Original rule',1000,'00000000-0000-4000-8000-000000000201',pg_temp.version_shares(),'monthly','2030-01-01','version-create',null,1)->>'recurring_expense_rule_id',true);
select set_config('test.version_original',(select updated_at::text from public.recurring_expense_rules where id=current_setting('test.version_rule')::uuid),true);
select public.generate_due_recurring_drafts('10000000-0000-4000-8000-000000000201','2030-01-01','version-generate');
select ok((select updated_at > current_setting('test.version_original')::timestamptz from public.recurring_expense_rules where id=current_setting('test.version_rule')::uuid),'due-draft generation strictly advances the edit version in the same transaction');
select throws_ok($$select pg_temp.edit_versioned_rule(current_setting('test.version_original')::timestamptz,'stale-after-generation')$$,'40001','This recurring expense changed. Reopen it before saving.','an old edit cannot overwrite the generated next-draft date');
select is((select next_occurrence_on from public.recurring_expense_rules where id=current_setting('test.version_rule')::uuid),'2030-02-01'::date,'generation date survives rejected edit');
select set_config('test.version_generated',(select updated_at::text from public.recurring_expense_rules where id=current_setting('test.version_rule')::uuid),true);
select public.set_recurring_expense_rule_active(current_setting('test.version_rule')::uuid,false,'version-pause');
select ok((select updated_at > current_setting('test.version_generated')::timestamptz from public.recurring_expense_rules where id=current_setting('test.version_rule')::uuid),'pause also advances the version');
select throws_ok($$select pg_temp.edit_versioned_rule(current_setting('test.version_generated')::timestamptz,'stale-after-pause')$$,'40001','This recurring expense changed. Reopen it before saving.','old edit cannot ignore a partner pause');
select set_config('test.version_edit',(select updated_at::text from public.recurring_expense_rules where id=current_setting('test.version_rule')::uuid),true);
-- Pause also emits this activity kind; measure only the edits under test.
select set_config('test.edit_activity_before',(select count(*)::integer from public.activity_events where household_id='10000000-0000-4000-8000-000000000201' and entity_id=current_setting('test.version_rule')::uuid and kind='recurring_expense_rule_updated')::text,true);
select lives_ok($$select pg_temp.edit_versioned_rule(current_setting('test.version_edit')::timestamptz,'version-edit')$$,'fresh version can edit');
select is((select count(*)::integer from public.activity_events where household_id='10000000-0000-4000-8000-000000000201' and entity_id=current_setting('test.version_rule')::uuid and kind='recurring_expense_rule_updated'),current_setting('test.edit_activity_before')::integer+1,'accepted edit adds exactly one activity');
select lives_ok($$select pg_temp.edit_versioned_rule(current_setting('test.version_edit')::timestamptz,'version-edit')$$,'identical retry replays before the stale version check');
select throws_ok($$select pg_temp.edit_versioned_rule(current_setting('test.version_edit')::timestamptz,'competing-edit')$$,'40001','This recurring expense changed. Reopen it before saving.','second command from the same baseline cannot overwrite the first');
select throws_ok($$select pg_temp.edit_versioned_rule(current_setting('test.version_edit')::timestamptz,'version-edit','Different label')$$,'22023','idempotency key was already used for a different command','key cannot be reused for different values');
select throws_ok($$select pg_temp.edit_versioned_rule(current_setting('test.version_generated')::timestamptz,'version-edit')$$,'22023','idempotency key was already used for a different command','version belongs to the exact idempotency payload');
select is((select count(*)::integer from public.activity_events where household_id='10000000-0000-4000-8000-000000000201' and entity_id=current_setting('test.version_rule')::uuid and kind='recurring_expense_rule_updated'),current_setting('test.edit_activity_before')::integer+1,'replay and conflicts add no duplicate edit activity');
select set_config('test.version_failure',(select updated_at::text from public.recurring_expense_rules where id=current_setting('test.version_rule')::uuid),true);
select set_config('test.fail_recurring_activity','on',true);
select throws_ok($$select pg_temp.edit_versioned_rule(current_setting('test.version_failure')::timestamptz,'rollback-edit','After failure')$$,'P0001','test failure after rule mutation','an error after the row update rolls back the command');
select is((select description from public.recurring_expense_rules where id=current_setting('test.version_rule')::uuid),'Updated rule','failed edit leaves prior values intact');
select is((select updated_at from public.recurring_expense_rules where id=current_setting('test.version_rule')::uuid),current_setting('test.version_failure')::timestamptz,'failed edit leaves prior version intact');
select set_config('test.fail_recurring_activity','off',true);
select lives_ok($$select pg_temp.edit_versioned_rule(current_setting('test.version_failure')::timestamptz,'rollback-edit','After failure')$$,'failed command did not consume its key');
select lives_ok($$select pg_temp.edit_versioned_rule(current_setting('test.version_edit')::timestamptz,'version-edit')$$,'original command still replays after a later accepted edit');
select is((select description from public.recurring_expense_rules where id=current_setting('test.version_rule')::uuid),'After failure','old replay cannot overwrite the later edit');
select is((select count(*)::integer from public.activity_events where household_id='10000000-0000-4000-8000-000000000201' and entity_id=current_setting('test.version_rule')::uuid and kind='recurring_expense_rule_updated'),current_setting('test.edit_activity_before')::integer+2,'two accepted edits add two activities despite failed commands and older replay');
select is((select amount_cents from public.expense_drafts where recurring_expense_rule_id=current_setting('test.version_rule')::uuid),1000::bigint,'existing draft amount remains unchanged');
select is((select count(*)::integer from public.financial_events where type<>'opening_balance'),0,'editing and generation do not post financial events');
select throws_ok($$select pg_temp.edit_versioned_rule(null,'missing-version')$$,'22023','Reload this recurring expense before editing','version is mandatory');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000203',true);
select throws_ok($$select pg_temp.edit_versioned_rule(current_setting('test.version_edit')::timestamptz,'version-edit')$$,'42501','caller is not a member of household 10000000-0000-4000-8000-000000000201','outsider cannot replay a member command');
select is((select count(*)::integer from public.recurring_expense_rules),0,'RLS keeps recurring rules private');
select * from finish();
rollback;
