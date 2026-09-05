begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,email) values
 ('47000000-0000-4000-8000-000000000001','routine-create-a@example.invalid'),
 ('47000000-0000-4000-8000-000000000002','routine-create-b@example.invalid'),
 ('47000000-0000-4000-8000-000000000003','routine-create-outsider@example.invalid');
insert into public.households(id,name) values ('47000100-0000-4000-8000-000000000001','Routine creation');
insert into public.household_members(household_id,user_id,display_name) values
 ('47000100-0000-4000-8000-000000000001','47000000-0000-4000-8000-000000000001','A'),
 ('47000100-0000-4000-8000-000000000001','47000000-0000-4000-8000-000000000002','B');
insert into public.areas(id,household_id,name) values ('47000200-0000-4000-8000-000000000001','47000100-0000-4000-8000-000000000001','Routine retry test area');
select set_config('test.create.payload',jsonb_build_object('title','Feed cat','areaId','47000200-0000-4000-8000-000000000001','assignmentPolicy','shared','scheduleKind','one_off','scheduleRule',jsonb_build_object('kind','one_off','date',(current_date+1)::text))::text,true);
create function pg_temp.create_once(key text, patch jsonb default '{}'::jsonb) returns jsonb language sql as $$
 select public.create_routine_once('47000100-0000-4000-8000-000000000001',key,current_setting('test.create.payload')::jsonb || patch)
$$;
select ok((select relrowsecurity from pg_class where oid='private.routine_creation_receipts'::regclass),'creation receipts enable RLS');
select ok(not has_table_privilege('authenticated','private.routine_creation_receipts','SELECT'),'members cannot read private receipts directly');
select ok(not has_table_privilege('authenticated','private.routine_creation_receipts','INSERT'),'members cannot forge receipts');
select ok(not has_table_privilege('anon','private.routine_creation_receipts','SELECT'),'anonymous callers cannot read receipts');
select ok(not has_function_privilege('anon','public.create_routine_once(uuid,text,jsonb)','EXECUTE'),'anonymous callers cannot execute creation');
select set_config('request.jwt.claim.sub','47000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select set_config('test.create.result',pg_temp.create_once('first')::text,true);
select is(pg_temp.create_once('first'),current_setting('test.create.result')::jsonb,'identical retry returns the original result');
select is((select count(*) from public.routines where title='Feed cat'),1::bigint,'retry creates one routine');
select is((select count(*) from public.routine_occurrences where household_id='47000100-0000-4000-8000-000000000001' and role='current'),1::bigint,'retry creates one current occurrence');
select throws_ok($$select pg_temp.create_once('first','{"title":"Changed"}')$$,'22023',null,'changed payload cannot reuse a receipt');
select throws_ok($$select pg_temp.create_once('')$$,'22023',null,'blank creation key rejected');
select throws_ok($$select pg_temp.create_once('bad','{"scheduleKind":"invalid"}')$$,'22023',null,'existing routine validation remains enforced');
select set_config('request.jwt.claim.sub','47000000-0000-4000-8000-000000000002',true);
select throws_ok($$select pg_temp.create_once('first')$$,'22023',null,'a second member cannot reuse another actors invocation');
select set_config('request.jwt.claim.sub','47000000-0000-4000-8000-000000000003',true);
select throws_ok($$select pg_temp.create_once('first')$$,'42501',null,'outsider cannot retrieve a cached result');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select pg_temp.create_once('first')$$,'42501',null,'missing identity cannot retrieve a cached result');
select set_config('request.jwt.claim.sub','47000000-0000-4000-8000-000000000001',true);
select lives_ok($$select pg_temp.create_once('second')$$,'a distinct invocation can create another routine');
select is((select count(*) from public.routines where title='Feed cat'),2::bigint,'two intentional invocations create two routines');
reset role;
select is((select count(*) from private.routine_creation_receipts where household_id='47000100-0000-4000-8000-000000000001'),2::bigint,'failed requests do not leave receipts');
select * from finish();
rollback;
