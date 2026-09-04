begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users (id, email) values
 ('f0000000-0000-4000-8000-000000000001', 'area-one@example.invalid'),
 ('f0000000-0000-4000-8000-000000000002', 'area-two@example.invalid'),
 ('f0000000-0000-4000-8000-000000000003', 'area-outsider@example.invalid');
insert into public.households (id, name) values
 ('f1000000-0000-4000-8000-000000000001', 'Area test household');
insert into public.household_members (household_id,user_id,display_name) values
 ('f1000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','One'),
 ('f1000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000002','Two');
select ok(not has_function_privilege('anon','public.reorder_household_areas(uuid[])','execute'), 'anonymous reorder is forbidden');
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.reorder_household_areas(array(select id from public.areas order by name desc))$$, 'member can reorder complete active list');
select results_eq($$select name from public.areas order by sort_order$$, $$select name from public.areas order by name desc$$, 'requested order is persisted');
select throws_ok($$select public.reorder_household_areas('{}'::uuid[])$$,'22023','area list has changed; refresh before reordering','partial list rejected');
select throws_ok($$select public.reorder_household_areas(null)$$,'22023','area list has changed; refresh before reordering','null list rejected');
select throws_ok($$select public.reorder_household_areas(array_fill((select id from public.areas limit 1), array[6]))$$,'22023','area list has changed; refresh before reordering','duplicate ids rejected');
select throws_ok($$select public.reorder_household_areas(array['f2000000-0000-4000-8000-000000000001']::uuid[])$$,'22023','area list has changed; refresh before reordering','foreign or nonexistent ids rejected');
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.reorder_household_areas(array(select id from public.areas order by name))$$, 'partner has equal reorder authority');
select throws_ok($$update public.areas set sort_order = 0$$, '42501', null, 'direct ordering update is forbidden');
select lives_ok($$update public.areas set name = name where household_id = 'f1000000-0000-4000-8000-000000000001'$$, 'renaming remains available');
select lives_ok($$insert into public.areas(household_id,name,sort_order) values ('f1000000-0000-4000-8000-000000000001','New room',0)$$,'new areas append even when caller supplies a conflicting position');
select is((select count(distinct sort_order) from public.areas), (select count(*) from public.areas), 'new area cannot reuse an existing position');
select is((select name from public.areas order by sort_order desc limit 1), 'New room', 'creation appends to current household order');
select is((select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename in ('areas','pets')), 2::bigint, 'area and pet changes are published to the partner');
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.reorder_household_areas('{}'::uuid[])$$,'42501','caller is not a household member','nonmember cannot reorder');
reset role;
select * from finish();
rollback;
