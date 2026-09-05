begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,email) values
 ('41000000-0000-4000-8000-000000000001','project-history-a@example.invalid'),
 ('41000000-0000-4000-8000-000000000002','project-history-b@example.invalid'),
 ('41000000-0000-4000-8000-000000000003','project-history-other@example.invalid');
insert into public.households(id,name) values
 ('41000100-0000-4000-8000-000000000001','Project history'),
 ('41000100-0000-4000-8000-000000000002','Other household');
insert into public.household_members(household_id,user_id,display_name) values
 ('41000100-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','Alex'),
 ('41000100-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','Sam'),
 ('41000100-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000003','Other');
create function pg_temp.fail_project_notice() returns trigger language plpgsql as $$
begin
 if current_setting('test.project_notice_failure',true)='on' and new.activity_kind='project_task_assigned' then
  raise exception 'test project notice failure' using errcode='P0001';
 end if;
 return new;
end;
$$;
create trigger test_project_notice_failure before insert on public.inbox_notifications
 for each row execute function pg_temp.fail_project_notice();
create function pg_temp.project_activity_count() returns integer language sql as $$
 select count(*)::integer from public.activity_events where household_id='41000100-0000-4000-8000-000000000001'
$$;
select ok(not has_function_privilege('authenticated','private.record_project_change()','EXECUTE'),'members cannot call the privileged trigger directly');
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$insert into public.household_projects(id,household_id,kind,title,description,destination,starts_on,ends_on) values
 ('41000200-0000-4000-8000-000000000001','41000100-0000-4000-8000-000000000001','trip','Spooky Szn ‘Murica','Original plan','USA','2026-10-24','2026-11-07')$$,
 'a trip with dates saves together with its creation activity');
select is(pg_temp.project_activity_count(),1,'project creation records one activity');
insert into public.project_tasks(id,household_id,project_id,title,assigned_member_id) values
 ('41000300-0000-4000-8000-000000000001','41000100-0000-4000-8000-000000000001','41000200-0000-4000-8000-000000000001','Book the hotel','41000000-0000-4000-8000-000000000002');
select is(pg_temp.project_activity_count(),2,'assigned task creation records one activity');
update public.project_tasks set assigned_member_id='41000000-0000-4000-8000-000000000002' where id='41000300-0000-4000-8000-000000000001';
select is(pg_temp.project_activity_count(),2,'unchanged assignment and timestamp-only updates do not add activity');
update public.project_tasks set notes='Call on Tuesday' where id='41000300-0000-4000-8000-000000000001';
select is((select payload->'before'->>'notes' from public.activity_events where entity_id='41000300-0000-4000-8000-000000000001' and payload->'after'->>'notes'='Call on Tuesday'),'','task history retains the previous accepted notes');
select is((select payload->'after'->>'notes' from public.activity_events where entity_id='41000300-0000-4000-8000-000000000001' and payload->'after'->>'notes'='Call on Tuesday'),'Call on Tuesday','task history retains the replacement notes');
update public.project_tasks set assigned_member_id='41000000-0000-4000-8000-000000000001' where id='41000300-0000-4000-8000-000000000001';
reset role;
select is((select count(*)::integer from public.inbox_notifications where household_id='41000100-0000-4000-8000-000000000001'),1,'unchanged assignee, ordinary edits and self-assignment do not send notices');
select is((select recipient_member_id::text from public.inbox_notifications where household_id='41000100-0000-4000-8000-000000000001'),'41000000-0000-4000-8000-000000000002','only the assigned partner receives the notice');
select is((select payload->>'project_id' from public.inbox_notifications where household_id='41000100-0000-4000-8000-000000000001'),'41000200-0000-4000-8000-000000000001','notice retains its task destination');
select is((select count(*)::integer from public.push_outbox where household_id='41000100-0000-4000-8000-000000000001'),1,'the assignment uses the normal durable outbox');
select set_config('test.project_history_before',pg_temp.project_activity_count()::text,true);
select set_config('test.project_notice_failure','on',true);
set local role authenticated;
select throws_ok($$update public.project_tasks set assigned_member_id='41000000-0000-4000-8000-000000000002',notes='Should roll back' where id='41000300-0000-4000-8000-000000000001'$$,'P0001','test project notice failure','notice failure rolls back the mutation and its prior activity insert');
select is((select assigned_member_id::text from public.project_tasks where id='41000300-0000-4000-8000-000000000001'),'41000000-0000-4000-8000-000000000001','failed assignment preserves the original member');
select is((select notes from public.project_tasks where id='41000300-0000-4000-8000-000000000001'),'Call on Tuesday','failed mutation preserves the previous notes');
select is(pg_temp.project_activity_count(),current_setting('test.project_history_before')::integer,'failed notification leaves no recovery-history artifact');
select set_config('test.project_notice_failure','off',true);
select lives_ok($$update public.project_tasks set assigned_member_id='41000000-0000-4000-8000-000000000002',notes='Accepted retry' where id='41000300-0000-4000-8000-000000000001'$$,'the rejected assignment can be retried');
update public.project_tasks set completed_at=now() where id='41000300-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.activity_events where entity_id='41000300-0000-4000-8000-000000000001' and payload->>'operation'='completed'),1,'completion remains visible in task history');
update public.household_projects set title='New trip',description='New plan' where id='41000200-0000-4000-8000-000000000001';
select is((select payload->'before'->>'description' from public.activity_events where entity_id='41000200-0000-4000-8000-000000000001' and payload->'after'->>'title'='New trip'),'Original plan','project edits retain their previous description');
update public.household_projects set archived_at=now() where id='41000200-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000002',true);
update public.household_projects set archived_at=null where id='41000200-0000-4000-8000-000000000001';
select is((select actor_member_id::text from public.activity_events where entity_id='41000200-0000-4000-8000-000000000001' and payload->>'operation'='restored'),'41000000-0000-4000-8000-000000000002','partner restore is attributed to the authenticated partner');
select is((select count(*)::integer from public.activity_events where entity_id='41000200-0000-4000-8000-000000000001' and payload->>'operation'='archived'),1,'archive history survives restoration');
select throws_ok($$insert into public.activity_events(household_id,actor_member_id,kind,entity_type,entity_id,payload) values ('41000100-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','project_record_changed','household_project','41000200-0000-4000-8000-000000000001','{}')$$,'42501',null,'members cannot forge another actor in history');
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000003',true);
select is((select count(*)::integer from public.activity_events where household_id='41000100-0000-4000-8000-000000000001'),0,'another household cannot read project recovery snapshots');
select is((select count(*)::integer from public.inbox_notifications where household_id='41000100-0000-4000-8000-000000000001'),0,'another household cannot read assignment notices');
select is_empty($$update public.project_tasks set title='Foreign overwrite' where id='41000300-0000-4000-8000-000000000001' returning id$$,'foreign edits cannot produce project activity');
reset role;
select is((select count(*)::integer from public.inbox_notifications where household_id='41000100-0000-4000-8000-000000000001'),2,'only the initial assignment and accepted reassignment produce notices');
select * from finish();
rollback;
