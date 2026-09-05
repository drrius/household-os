begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000251','fallback-one@example.invalid'),
 ('00000000-0000-4000-8000-000000000252','fallback-two@example.invalid');
insert into public.households(id,name) values
 ('10000000-0000-4000-8000-000000000251','First fallback household'),
 ('10000000-0000-4000-8000-000000000252','Second fallback household');
insert into public.household_members(household_id,user_id,display_name) values
 ('10000000-0000-4000-8000-000000000251','00000000-0000-4000-8000-000000000251','Alex'),
 ('10000000-0000-4000-8000-000000000252','00000000-0000-4000-8000-000000000252','Sam');
select is((select count(*)::integer from public.grocery_categories where household_id in ('10000000-0000-4000-8000-000000000251','10000000-0000-4000-8000-000000000252') and is_fallback),2,'each new household receives one stable fallback');
select ok((select bool_and(name='Other') from public.grocery_categories where household_id in ('10000000-0000-4000-8000-000000000251','10000000-0000-4000-8000-000000000252') and is_fallback),'seeding identifies the original Other category');
select ok((select relrowsecurity from pg_class where oid='public.grocery_categories'::regclass),'category identity remains under RLS');
select ok(not has_column_privilege('authenticated','public.grocery_categories','is_fallback','INSERT'),'clients cannot create fallback identities');
select ok(not has_column_privilege('authenticated','public.grocery_categories','is_fallback','UPDATE'),'clients cannot transfer fallback identity');
select throws_ok($$insert into public.grocery_categories(household_id,name,sort_order,is_fallback) values ('10000000-0000-4000-8000-000000000251','Duplicate fallback',30,true)$$,'23505',null,'even privileged code cannot create two fallback identities in one household');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000251',true);
set local role authenticated;
select set_config('test.fallback_id',(select id::text from public.grocery_categories where is_fallback),true);
select is((select count(*)::integer from public.grocery_categories where is_fallback),1,'first member sees only their household fallback');
select lives_ok($$update public.grocery_categories set name='Odds and ends',sort_order=0 where is_fallback$$,'fallback can be renamed and reordered');
select is((select id::text from public.grocery_categories where is_fallback),current_setting('test.fallback_id'),'rename keeps the stable category identity');
select lives_ok($$insert into public.grocery_categories(household_id,name,sort_order) values ('10000000-0000-4000-8000-000000000251','Other',11)$$,'custom categories can use the former label');
select ok((select not is_fallback from public.grocery_categories where name='Other'),'custom Other does not absorb uncategorized items');
select throws_ok($$insert into public.grocery_categories(household_id,name,sort_order,is_fallback) values ('10000000-0000-4000-8000-000000000251','Spoof',12,true)$$,'42501',null,'direct insert cannot spoof the fallback flag');
select throws_ok($$update public.grocery_categories set is_fallback=false where is_fallback$$,'42501',null,'direct update cannot remove the fallback flag');
select lives_ok($$update public.grocery_categories set archived_at=now() where is_fallback$$,'fallback category can be archived');
select is((select count(*)::integer from public.grocery_categories where is_fallback and archived_at is null),0,'archived fallback is excluded from active grouping');
select lives_ok($$update public.grocery_categories set archived_at=null where is_fallback$$,'restoring fallback retains its identity');
select is((select id::text from public.grocery_categories where is_fallback and archived_at is null),current_setting('test.fallback_id'),'restored category resumes its fallback role');
select is_empty($$update public.grocery_categories set name='Cross-household rename' where household_id='10000000-0000-4000-8000-000000000252' returning id$$,'first member cannot rename another household category');
select throws_ok($$insert into public.grocery_categories(household_id,name,sort_order) values ('10000000-0000-4000-8000-000000000252','Cross-household insert',12)$$,'42501',null,'first member cannot insert into another household');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000252',true);
select is((select count(*)::integer from public.grocery_categories where household_id='10000000-0000-4000-8000-000000000251'),0,'second member cannot read first household categories');
select is((select name from public.grocery_categories where is_fallback),'Other','second household fallback is independent');
reset role;
select * from finish();
rollback;
