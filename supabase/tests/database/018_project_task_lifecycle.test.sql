begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,email) values
 ('18000000-0000-4000-8000-000000000001','project-a@example.invalid'),
 ('18000000-0000-4000-8000-000000000002','project-b@example.invalid'),
 ('18000000-0000-4000-8000-000000000003','project-c@example.invalid');
insert into public.households(id,name) values
 ('18000100-0000-4000-8000-000000000001','Task lifecycle'),
 ('18000100-0000-4000-8000-000000000002','Other household');
insert into public.household_members(household_id,user_id,display_name) values
 ('18000100-0000-4000-8000-000000000001','18000000-0000-4000-8000-000000000001','A'),
 ('18000100-0000-4000-8000-000000000001','18000000-0000-4000-8000-000000000002','B'),
 ('18000100-0000-4000-8000-000000000002','18000000-0000-4000-8000-000000000003','C');
set local role authenticated;
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000001',true);
insert into public.household_projects(id,household_id,kind,title) values
 ('18000200-0000-4000-8000-000000000001','18000100-0000-4000-8000-000000000001','project','House repairs');
select lives_ok($$insert into public.project_tasks(id,household_id,project_id,title) values ('18000300-0000-4000-8000-000000000001','18000100-0000-4000-8000-000000000001','18000200-0000-4000-8000-000000000001','Call the plumber')$$,'active parent accepts a task');
select lives_ok($$update public.project_tasks set notes='Ask about Tuesday' where id='18000300-0000-4000-8000-000000000001'$$,'active parent accepts task edits');
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000002',true);
update public.household_projects set archived_at=now() where id='18000200-0000-4000-8000-000000000001';
select throws_ok($$insert into public.project_tasks(household_id,project_id,title) values ('18000100-0000-4000-8000-000000000001','18000200-0000-4000-8000-000000000001','Late addition')$$,'55000',null,'archive winning the lock prevents a later insert');
select throws_ok($$update public.project_tasks set notes='Late edit' where id='18000300-0000-4000-8000-000000000001'$$,'55000',null,'archived parent rejects direct edits');
select throws_ok($$update public.project_tasks set completed_at=now() where id='18000300-0000-4000-8000-000000000001'$$,'55000',null,'archived parent rejects completion');
select throws_ok($$update public.project_tasks set archived_at=now() where id='18000300-0000-4000-8000-000000000001'$$,'55000',null,'archived parent rejects task lifecycle edits');
select is((select notes from public.project_tasks where id='18000300-0000-4000-8000-000000000001'),'Ask about Tuesday','rejected edits preserve the task');
select is((select count(*) from public.project_tasks),1::bigint,'task written before parent archive remains readable');
update public.household_projects set archived_at=null where id='18000200-0000-4000-8000-000000000001';
select lives_ok($$update public.project_tasks set completed_at=now() where id='18000300-0000-4000-8000-000000000001'$$,'partner can complete after restoring the parent');
select is((select completed_by_member_id::text from public.project_tasks where id='18000300-0000-4000-8000-000000000001'),'18000000-0000-4000-8000-000000000002','completion still records the authenticated actor');
select throws_ok($$select private.guard_project_task_parent_state()$$,'42501',null,'private trigger helper cannot be invoked directly');
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.project_tasks),0::bigint,'outsider cannot read tasks');
select throws_ok($$insert into public.project_tasks(household_id,project_id,title) values ('18000100-0000-4000-8000-000000000001','18000200-0000-4000-8000-000000000001','Foreign write')$$,'42501',null,'outsider cannot mutate the household');
select throws_ok($$insert into public.project_tasks(household_id,project_id,title) values ('18000100-0000-4000-8000-000000000002','18000200-0000-4000-8000-000000000001','Foreign parent')$$,'42501',null,'own household cannot attach to another household parent');
reset role;
select * from finish();
rollback;
