begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000191','routine-version-a@example.invalid'),
 ('00000000-0000-4000-8000-000000000192','routine-version-b@example.invalid'),
 ('00000000-0000-4000-8000-000000000193','routine-version-outsider@example.invalid');
insert into public.households(id,name) values ('10000000-0000-4000-8000-000000000191','Routine versions');
insert into public.household_members(household_id,user_id,display_name) values
 ('10000000-0000-4000-8000-000000000191','00000000-0000-4000-8000-000000000191','A'),
 ('10000000-0000-4000-8000-000000000191','00000000-0000-4000-8000-000000000192','B');
insert into public.areas(id,household_id,name,sort_order) values
 ('20000000-0000-4000-8000-000000000191','10000000-0000-4000-8000-000000000191','First',1),
 ('20000000-0000-4000-8000-000000000192','10000000-0000-4000-8000-000000000191','Second',2);
insert into public.pets(id,household_id,name) values ('30000000-0000-4000-8000-000000000191','10000000-0000-4000-8000-000000000191','Pet');
create function pg_temp.edit_routine_version(version timestamptz, command_key text, patch jsonb) returns jsonb language sql as $$
 select public.edit_routine_definition(current_setting('test.version_routine')::uuid,version,command_key,patch)
$$;
create function pg_temp.fail_routine_receipt() returns trigger language plpgsql as $$
begin
 if current_setting('test.fail_routine_receipt',true)='on' then
  raise exception 'test failure after routine mutation' using errcode='P0001';
 end if;
 return new;
end;
$$;
create trigger test_fail_routine_receipt before insert on private.routine_edit_receipts for each row execute function pg_temp.fail_routine_receipt();
select ok(not has_function_privilege('authenticated','public.update_routine_definition(uuid,text,text,uuid,uuid,text,uuid,uuid,text,jsonb,text,date,date,boolean)','EXECUTE'),'old edit command cannot bypass versions');
select ok(not has_function_privilege('anon','public.edit_routine_definition(uuid,timestamptz,text,jsonb)','EXECUTE'),'anonymous edits unavailable');
select ok(not has_column_privilege('authenticated','public.routines','instructions','UPDATE'),'direct descriptive updates cannot bypass versions');
select ok((select relrowsecurity from pg_class where oid='private.routine_edit_receipts'::regclass),'private edit receipts have RLS enabled');
select ok(not has_table_privilege('authenticated','private.routine_edit_receipts','INSERT'),'receipts are command-owned');
select ok((select relrowsecurity from pg_class where oid='private.routine_edit_clear_intents'::regclass),'clear intent has RLS enabled');
select ok(not has_table_privilege('authenticated','private.routine_edit_clear_intents','INSERT'),'members cannot forge clear intent');
select ok(not has_table_privilege('authenticated','private.routine_edit_clear_intents','DELETE'),'members cannot consume clear intent');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000191',true);
set local role authenticated;
select public.create_routine(
 p_household_id=>'10000000-0000-4000-8000-000000000191',p_title=>'Version routine',
 p_area_id=>'20000000-0000-4000-8000-000000000191',p_assignment_policy=>'shared',
 p_schedule_kind=>'one_off',p_schedule_rule=>jsonb_build_object('kind','one_off','date',(current_date+1)::text),
 p_instructions=>'Keep these instructions',p_pet_id=>'30000000-0000-4000-8000-000000000191',
 p_active_from=>'2020-01-01',p_active_until=>'2099-12-31'
);
select set_config('test.version_routine',(select id::text from public.routines where title='Version routine'),true);
select set_config('test.routine_v1',(select updated_at::text from public.routines where id=current_setting('test.version_routine')::uuid),true);
select lives_ok($$select pg_temp.edit_routine_version(current_setting('test.routine_v1')::timestamptz,'first-edit','{"title":"First accepted edit"}')$$,'fresh baseline saves');
select ok((select updated_at>current_setting('test.routine_v1')::timestamptz from public.routines where id=current_setting('test.version_routine')::uuid),'accepted edit strictly advances version within the transaction');
select lives_ok($$select pg_temp.edit_routine_version(current_setting('test.routine_v1')::timestamptz,'first-edit','{"title":"First accepted edit"}')$$,'same-key replay succeeds before CAS');
select throws_ok($$select pg_temp.edit_routine_version(current_setting('test.routine_v1')::timestamptz,'competing-edit','{"title":"Losing edit"}')$$,'40001','This routine changed. Reopen it before saving.','competing command from old baseline cannot overwrite');
select throws_ok($$select pg_temp.edit_routine_version(current_setting('test.routine_v1')::timestamptz,'first-edit','{"title":"Different payload"}')$$,'22023','Routine edit key was already used for different changes','key binds exact changes');
select set_config('test.routine_v2',(select updated_at::text from public.routines where id=current_setting('test.version_routine')::uuid),true);
select throws_ok($$select pg_temp.edit_routine_version(current_setting('test.routine_v2')::timestamptz,'first-edit','{"title":"First accepted edit"}')$$,'22023','Routine edit key was already used for different changes','key also binds exact expected version');
select lives_ok($$select pg_temp.edit_routine_version(current_setting('test.routine_v2')::timestamptz,'area-only','{"area_id":"20000000-0000-4000-8000-000000000192"}')$$,'partial area edit succeeds');
select is((select pet_id from public.routines where id=current_setting('test.version_routine')::uuid),'30000000-0000-4000-8000-000000000191'::uuid,'omitted pet remains linked when area changes');
select lives_ok($$select pg_temp.edit_routine_version(current_setting('test.routine_v1')::timestamptz,'first-edit','{"title":"First accepted edit"}')$$,'earlier command can replay after a later edit');
select is((select area_id from public.routines where id=current_setting('test.version_routine')::uuid),'20000000-0000-4000-8000-000000000192'::uuid,'old replay cannot undo later values');
select set_config('test.routine_v3',(select updated_at::text from public.routines where id=current_setting('test.version_routine')::uuid),true);
select set_config('test.activity_count',(select count(*)::text from public.activity_events),true);
select set_config('test.fail_routine_receipt','on',true);
select throws_ok($$select pg_temp.edit_routine_version(current_setting('test.routine_v3')::timestamptz,'clear-fields','{"instructions":null,"pet_id":null,"active_until":null}')$$,'P0001','test failure after routine mutation','failure after internal edits and activity rolls back all changes');
select is((select instructions from public.routines where id=current_setting('test.version_routine')::uuid),'Keep these instructions','explicit optional clear rolls back');
select is((select pet_id from public.routines where id=current_setting('test.version_routine')::uuid),'30000000-0000-4000-8000-000000000191'::uuid,'internal pet clear rolls back');
select is((select updated_at from public.routines where id=current_setting('test.version_routine')::uuid),current_setting('test.routine_v3')::timestamptz,'failed command does not advance version');
select is((select count(*)::integer from public.activity_events),current_setting('test.activity_count')::integer,'failed command leaves no activity');
reset role;
select is((select count(*)::integer from private.routine_edit_clear_intents),0,'failed edit leaves no clear intent');
set local role authenticated;
select set_config('test.fail_routine_receipt','off',true);
select lives_ok($$select pg_temp.edit_routine_version(current_setting('test.routine_v3')::timestamptz,'clear-fields','{"instructions":null,"pet_id":null,"active_until":null}')$$,'failure did not consume key and retry clears atomically');
select ok((select instructions is null and pet_id is null and active_until is null from public.routines where id=current_setting('test.version_routine')::uuid),'requested clears all persisted');
select is((select area_id from public.routines where id=current_setting('test.version_routine')::uuid),'20000000-0000-4000-8000-000000000192'::uuid,'clearing pet preserves the omitted area');
select is((select active_from from public.routines where id=current_setting('test.version_routine')::uuid),'2020-01-01'::date,'omitted window boundary is preserved');
select set_config('test.routine_v4',(select updated_at::text from public.routines where id=current_setting('test.version_routine')::uuid),true);
select throws_ok($$select pg_temp.edit_routine_version(current_setting('test.routine_v4')::timestamptz,'invalid-before-clear','{"instructions":null,"schedule_kind":"one_off","schedule_rule":{"kind":"invalid"}}')$$,'22023',null,'validation failure before clear-intent consumption rolls back intent');
reset role;
select is((select count(*)::integer from private.routine_edit_clear_intents),0,'validation failure leaves no pending clear intent');
set local role authenticated;
reset role;
select set_config('test.window_notice_count',(select count(*)::text from public.inbox_notifications where recipient_member_id='00000000-0000-4000-8000-000000000192' and activity_kind='routine_updated'),true);
set local role authenticated;
select lives_ok($$select pg_temp.edit_routine_version(current_setting('test.routine_v4')::timestamptz,'clear-window','{"active_from":null,"active_until":null}')$$,'both optional window boundaries can be cleared together');
select ok((select active_from is null and active_until is null from public.routines where id=current_setting('test.version_routine')::uuid),'full window clear persisted');
reset role;
select is((select count(*)::integer from public.inbox_notifications where recipient_member_id='00000000-0000-4000-8000-000000000192' and activity_kind='routine_updated'),current_setting('test.window_notice_count')::integer+1,'clearing the full window notifies the affected partner');
set local role authenticated;
select lives_ok($$select pg_temp.edit_routine_version(current_setting('test.routine_v4')::timestamptz,'clear-window','{"active_from":null,"active_until":null}')$$,'full-window clear replays');
reset role;
select is((select count(*)::integer from public.inbox_notifications where recipient_member_id='00000000-0000-4000-8000-000000000192' and activity_kind='routine_updated'),current_setting('test.window_notice_count')::integer+1,'replaying the clear does not duplicate the partner notice');
set local role authenticated;
select set_config('test.routine_before_pause',(select updated_at::text from public.routines where id=current_setting('test.version_routine')::uuid),true);
select public.pause_routine(current_setting('test.version_routine')::uuid);
select throws_ok($$select pg_temp.edit_routine_version(current_setting('test.routine_before_pause')::timestamptz,'stale-after-pause','{"title":"Ignore pause"}')$$,'40001','This routine changed. Reopen it before saving.','pause advances version and rejects stale form');
select throws_ok($$update public.routines set instructions='Bypass' where id=current_setting('test.version_routine')::uuid$$,'42501',null,'direct field update is denied');
select throws_ok($$insert into private.routine_edit_clear_intents(household_id,routine_id,clear_instructions,clear_window) values ('10000000-0000-4000-8000-000000000191',current_setting('test.version_routine')::uuid,true,false)$$,'42501',null,'members cannot plant clear intent for another command');
select throws_ok($$select * from private.routine_edit_receipts$$,'42501',null,'members cannot inspect internal receipts directly');
select throws_ok($$select pg_temp.edit_routine_version(null,'missing-version','{}')$$,'22023','Reload this routine before editing','version is required');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000193',true);
select throws_ok($$select pg_temp.edit_routine_version(current_setting('test.routine_v1')::timestamptz,'first-edit','{"title":"First accepted edit"}')$$,'42501','Caller cannot edit this routine','outsider cannot replay another household edit');
select is((select count(*)::integer from public.routines),0,'RLS hides routines from outsiders');
reset role;
select is((select count(*)::integer from private.routine_edit_clear_intents),0,'successful edits leave no clear intent');
select is((select count(*)::integer from private.routine_edit_receipts where household_id='10000000-0000-4000-8000-000000000191'),4,'only accepted logical edits have receipts');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000191',true);
set local role authenticated;
select public.create_routine(
 p_household_id=>'10000000-0000-4000-8000-000000000191',p_title=>'Closure interaction',
 p_area_id=>'20000000-0000-4000-8000-000000000191',p_assignment_policy=>'shared',
 p_schedule_kind=>'after_completion',p_schedule_rule=>'{"kind":"after_completion","every":3,"unit":"days"}'::jsonb
);
select set_config('test.version_routine',(select id::text from public.routines where title='Closure interaction'),true);
select set_config('test.current_before',(select id::text from public.routine_occurrences where routine_id=current_setting('test.version_routine')::uuid and status='open' and role='current'),true);
select set_config('test.original_before',(select original_due_date::text from public.routine_occurrences where id=current_setting('test.current_before')::uuid),true);
select public.reschedule_occurrence(current_setting('test.current_before')::uuid,current_date+7,'lock-order-reschedule');
select lives_ok($$select pg_temp.edit_routine_version((select updated_at from public.routines where id=current_setting('test.version_routine')::uuid),'lock-order-assignment','{"assignment_policy":"assigned","assigned_member_id":"00000000-0000-4000-8000-000000000192"}')$$,'an ordinary current/preview window can be edited after rescheduling');
select is((select due_date from public.routine_occurrences where routine_id=current_setting('test.version_routine')::uuid and status='open' and role='current'),current_date+7,'assignment rebuild preserves the rescheduled due date');
select is((select original_due_date::text from public.routine_occurrences where routine_id=current_setting('test.version_routine')::uuid and status='open' and role='current'),current_setting('test.original_before'),'assignment rebuild preserves the original recurrence anchor');
select public.skip_occurrence((select id from public.routine_occurrences where routine_id=current_setting('test.version_routine')::uuid and status='open' and role='current'),'lock-order-skip');
select lives_ok($$select pg_temp.edit_routine_version((select updated_at from public.routines where id=current_setting('test.version_routine')::uuid),'lock-order-window',jsonb_build_object('active_until',current_date+30))$$,'a window edit works after closure has replaced the current occurrence');
select is((select count(*)::integer from public.routine_occurrences where routine_id=current_setting('test.version_routine')::uuid and status='open' and role='current'),1,'the rebuilt window keeps one current occurrence');
select is((select count(*)::integer from public.routine_occurrences where routine_id=current_setting('test.version_routine')::uuid and status='skipped'),1,'a subsequent edit preserves closure history');
reset role;
select * from finish();
rollback;
