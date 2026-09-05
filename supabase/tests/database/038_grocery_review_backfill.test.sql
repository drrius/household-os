begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000381','backfill-one@example.invalid'),
 ('00000000-0000-4000-8000-000000000382','backfill-two@example.invalid');
insert into public.households(id,name) values
 ('10000000-0000-4000-8000-000000000381','Renamed pre-release default'),
 ('10000000-0000-4000-8000-000000000382','Existing identified default');
insert into public.household_members(household_id,user_id,display_name) values
 ('10000000-0000-4000-8000-000000000381','00000000-0000-4000-8000-000000000381','Alex'),
 ('10000000-0000-4000-8000-000000000382','00000000-0000-4000-8000-000000000382','Sam');
-- Recreate the predecessor's renamed default with no fallback flag.
update public.grocery_categories set name='Odds and ends',is_fallback=false
where household_id='10000000-0000-4000-8000-000000000381' and is_fallback;
select set_config('test.original_default',(select id::text from public.grocery_categories where household_id='10000000-0000-4000-8000-000000000381' and name='Odds and ends'),true);
select set_config('test.other_default',(select id::text from public.grocery_categories where household_id='10000000-0000-4000-8000-000000000382' and is_fallback),true);
-- Exercise the actual data migration, not a copy of its INSERT statement.
\ir ../../migrations/20260905085807_grocery_review_guards.sql
select is((select count(*)::integer from public.grocery_categories where household_id='10000000-0000-4000-8000-000000000381' and is_fallback),1,'renamed pre-release household receives one persistent fallback');
select ok((select name='Other' and archived_at is null and sort_order>=0 from public.grocery_categories where household_id='10000000-0000-4000-8000-000000000381' and is_fallback),'new fallback is active and has valid ordering');
select ok((select name='Odds and ends' and not is_fallback from public.grocery_categories where id=current_setting('test.original_default')::uuid),'renamed category identity and name are preserved');
select is((select id::text from public.grocery_categories where household_id='10000000-0000-4000-8000-000000000382' and is_fallback),current_setting('test.other_default'),'existing household fallback is preserved');
\ir ../../migrations/20260905085807_grocery_review_guards.sql
select is((select count(*)::integer from public.grocery_categories where household_id='10000000-0000-4000-8000-000000000381' and is_fallback),1,'repeating the backfill does not duplicate the category');
select ok((select convalidated from pg_constraint where conname='shopping_sessions_cancelled_finish_check' and conrelid='public.shopping_sessions'::regclass),'lifecycle constraint is validated by the follow-up migration');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000381',true);
set local role authenticated;
select is((select count(*)::integer from public.grocery_categories where is_fallback),1,'member sees the repaired fallback only in their household');
select is_empty($$update public.grocery_categories set name='Foreign edit' where household_id='10000000-0000-4000-8000-000000000382' returning id$$,'backfill does not weaken tenant update isolation');
reset role;
select * from finish();
rollback;
