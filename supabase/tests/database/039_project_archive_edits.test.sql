begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,email) values
 ('39000000-0000-4000-8000-000000000001','project-guard-a@example.invalid'),
 ('39000000-0000-4000-8000-000000000002','project-guard-b@example.invalid'),
 ('39000000-0000-4000-8000-000000000003','project-guard-c@example.invalid');
insert into public.households(id,name) values
 ('39000100-0000-4000-8000-000000000001','Project guards'),
 ('39000100-0000-4000-8000-000000000002','Other household');
insert into public.household_members(household_id,user_id,display_name) values
 ('39000100-0000-4000-8000-000000000001','39000000-0000-4000-8000-000000000001','Alex'),
 ('39000100-0000-4000-8000-000000000001','39000000-0000-4000-8000-000000000002','Sam'),
 ('39000100-0000-4000-8000-000000000002','39000000-0000-4000-8000-000000000003','Other');
select set_config('request.jwt.claim.sub','39000000-0000-4000-8000-000000000001',true);
set local role authenticated;
insert into public.household_projects(id,household_id,kind,title) values
 ('39000200-0000-4000-8000-000000000001','39000100-0000-4000-8000-000000000001','trip','Summer trip'),
 ('39000200-0000-4000-8000-000000000002','39000100-0000-4000-8000-000000000001','project','Active plan');
insert into public.project_tasks(id,household_id,project_id,title) values
 ('39000300-0000-4000-8000-000000000001','39000100-0000-4000-8000-000000000001','39000200-0000-4000-8000-000000000001','Book a hotel');
update public.household_projects set archived_at=now() where id='39000200-0000-4000-8000-000000000001';
select throws_ok($$update public.household_projects set title='Hidden edit' where id='39000200-0000-4000-8000-000000000001'$$,'55000',null,'archived plans reject direct detail edits');
select throws_ok($$update public.household_projects set archived_at=null,status='complete' where id='39000200-0000-4000-8000-000000000001'$$,'55000',null,'restoration cannot smuggle a status edit');
select throws_ok($$update public.project_tasks set project_id='39000200-0000-4000-8000-000000000002' where id='39000300-0000-4000-8000-000000000001'$$,'23514',null,'task cannot move out of an archived source plan');
select is((select title from public.household_projects where id='39000200-0000-4000-8000-000000000001'),'Summer trip','rejected edit preserves the title');
select is((select project_id::text from public.project_tasks where id='39000300-0000-4000-8000-000000000001'),'39000200-0000-4000-8000-000000000001','rejected move preserves task parent');
select set_config('request.jwt.claim.sub','39000000-0000-4000-8000-000000000002',true);
select lives_ok($$update public.household_projects set archived_at=null where id='39000200-0000-4000-8000-000000000001'$$,'other member can restore the plan');
select lives_ok($$update public.household_projects set title='Restored trip' where id='39000200-0000-4000-8000-000000000001'$$,'restored plan permits ordinary edits');
select lives_ok($$update public.project_tasks set notes='Call on Tuesday' where id='39000300-0000-4000-8000-000000000001'$$,'restored plan permits task edits');
select throws_ok($$update public.project_tasks set project_id='39000200-0000-4000-8000-000000000002' where id='39000300-0000-4000-8000-000000000001'$$,'23514',null,'task parent identity also holds between active plans');
select set_config('request.jwt.claim.sub','39000000-0000-4000-8000-000000000003',true);
select is_empty($$update public.household_projects set title='Foreign edit' where id='39000200-0000-4000-8000-000000000001' returning id$$,'outsider cannot edit the plan');
select is((select count(*)::integer from public.project_tasks),0,'outsider cannot read the task');
reset role;
select * from finish();
rollback;
