begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,email) values('27000000-0000-4000-8000-000000000001','choice-a@example.invalid'),('27000000-0000-4000-8000-000000000002','choice-b@example.invalid');
insert into public.households(id,name) values('27000100-0000-4000-8000-000000000001','Choice home'),('27000100-0000-4000-8000-000000000002','Other');
insert into public.household_members(household_id,user_id,display_name) values('27000100-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','A'),('27000100-0000-4000-8000-000000000002','27000000-0000-4000-8000-000000000002','B');
insert into public.household_decisions(id,household_id,created_by,title) values('27000200-0000-4000-8000-000000000001','27000100-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','Choose'),('27000200-0000-4000-8000-000000000002','27000100-0000-4000-8000-000000000002','27000000-0000-4000-8000-000000000002','Private');
insert into public.decision_options(id,household_id,created_by,decision_id,title) values
 ('27000300-0000-4000-8000-000000000001','27000100-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','27000200-0000-4000-8000-000000000001','One'),
 ('27000300-0000-4000-8000-000000000002','27000100-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','27000200-0000-4000-8000-000000000001','Two'),
 ('27000300-0000-4000-8000-000000000003','27000100-0000-4000-8000-000000000002','27000000-0000-4000-8000-000000000002','27000200-0000-4000-8000-000000000002','Foreign');
create temporary table choice_writes(table_name text);
grant select on choice_writes to authenticated;
create function pg_temp.count_choice_write() returns trigger language plpgsql security definer set search_path='' as $$begin insert into pg_temp.choice_writes values(tg_table_name); return new; end;$$;
create trigger test_choice_write after update on public.decision_options for each row execute function pg_temp.count_choice_write();
create trigger test_decision_write after update on public.household_decisions for each row execute function pg_temp.count_choice_write();
set local role authenticated;
select set_config('request.jwt.claim.sub','27000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.choose_household_decision_option('27000200-0000-4000-8000-000000000001','27000300-0000-4000-8000-000000000001')$$,'first choice succeeds');
select is((select count(*) from choice_writes),2::bigint,'first choice writes only option and status');
select public.choose_household_decision_option('27000200-0000-4000-8000-000000000001','27000300-0000-4000-8000-000000000001');
select is((select count(*) from choice_writes),2::bigint,'retry neither unchooses option nor rewrites status');
select public.choose_household_decision_option('27000200-0000-4000-8000-000000000001',null);
select is((select count(*) from choice_writes),4::bigint,'clear writes only chosen option and changed status');
select public.choose_household_decision_option('27000200-0000-4000-8000-000000000001',null);
select is((select count(*) from choice_writes),4::bigint,'clear retry has no writes');
select public.choose_household_decision_option('27000200-0000-4000-8000-000000000001','27000300-0000-4000-8000-000000000002');
select public.choose_household_decision_option('27000200-0000-4000-8000-000000000001','27000300-0000-4000-8000-000000000001');
select is((select count(*) from choice_writes),8::bigint,'switching between options does not rewrite unchanged decided status');
select is((select id::text from public.decision_options where chosen),'27000300-0000-4000-8000-000000000001','exactly the requested option remains chosen');
select throws_ok($$select public.choose_household_decision_option('27000200-0000-4000-8000-000000000001','27000300-0000-4000-8000-000000000003')$$,'23514',null,'foreign option is unavailable');
select is((select count(*) from choice_writes),8::bigint,'rejected choice has no partial writes');
select set_config('request.jwt.claim.sub','27000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.choose_household_decision_option('27000200-0000-4000-8000-000000000001',null)$$,'42501',null,'outsider cannot clear a choice');
select is((select count(*) from public.financial_events),0::bigint,'choosing never posts money');
reset role; set local role anon;
select throws_ok($$select public.choose_household_decision_option('27000200-0000-4000-8000-000000000001',null)$$,'42501',null,'anonymous callers cannot choose');
reset role;
select * from finish(); rollback;
