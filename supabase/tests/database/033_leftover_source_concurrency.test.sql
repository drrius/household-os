-- Local/CI database test: dblink needs committed fixtures visible to both sessions.
-- Each run uses random IDs and deletes only those fixtures before disconnecting.
begin;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select no_plan();
select set_config('test.race.household',gen_random_uuid()::text,true);
select set_config('test.race.member',gen_random_uuid()::text,true);
select set_config('test.race.source',gen_random_uuid()::text,true);
-- Use this project's disposable Docker service name, not trusted loopback.
-- Supabase's container-network HBA rule requires SCRAM authentication, which
-- ordinary dblink accepts without administrative function grants.
select extensions.dblink_connect('race_a','host=supabase_db_household-os port=5432 user=postgres password=postgres dbname='||current_database());
select extensions.dblink_connect('race_b','host=supabase_db_household-os port=5432 user=postgres password=postgres dbname='||current_database());
select extensions.dblink_exec('race_a',format($setup$
 insert into auth.users(id,email) values (%1$L,%1$L||'@leftover-race.example.invalid');
 insert into public.households(id,name) values (%2$L,'Leftover race fixture');
 insert into public.household_members(household_id,user_id,display_name) values (%2$L,%1$L,'Race fixture');
 insert into public.meal_plan_entries(id,household_id,date,slot,title_snapshot) values (%3$L,%2$L,'2030-08-01','dinner','Source');
$setup$,current_setting('test.race.member'),current_setting('test.race.household'),current_setting('test.race.source')));
select * from extensions.dblink('race_a',format('select set_config(''request.jwt.claim.sub'',%L,false)',current_setting('test.race.member'))) as result(value text);
select * from extensions.dblink('race_b',format('select set_config(''request.jwt.claim.sub'',%L,false)',current_setting('test.race.member'))) as result(value text);
select extensions.dblink_exec('race_a','set role authenticated');
select extensions.dblink_exec('race_b','set role authenticated; set statement_timeout=''5s''');
select set_config('test.race.pid',(select pid::text from extensions.dblink('race_b','select pg_backend_pid()') as result(pid integer)),true);

create function pg_temp.wait_for_race_lock(target integer) returns boolean language plpgsql as $$
begin
 for attempt in 1..100 loop
  perform pg_stat_clear_snapshot();
  if exists(select 1 from pg_stat_activity where pid=target and wait_event_type='Lock') then return true; end if;
  perform pg_sleep(0.01);
 end loop;
 return false;
end;
$$;

select extensions.dblink_exec('race_a','begin');
select * from extensions.dblink('race_a',format('select public.move_meal_plan_entry(%L,''2030-08-04'',''dinner'',''033-source-move'')',current_setting('test.race.source'))) as result(payload jsonb);
select is(extensions.dblink_send_query('race_b',format('select public.place_meal(%L,''2030-08-03'',''lunch'',''leftover'',''033-overlap'',null,%L)',current_setting('test.race.household'),current_setting('test.race.source'))),1,'leftover placement starts while the source move is uncommitted');
select ok(pg_temp.wait_for_race_lock(current_setting('test.race.pid')::integer),'the second session reaches the source lock before the move commits');
select extensions.dblink_exec('race_a','commit');
-- Without the source lock in validation, only the FK waits, then the invalid
-- earlier leftover commits because its date was checked against the old row.
select throws_ok($$select * from extensions.dblink_get_result('race_b') as result(payload jsonb)$$,'23514','leftover source must be earlier than the target entry','placement rechecks the new source date after the concurrent move commits');
select * from extensions.dblink_get_result('race_b') as result(payload jsonb);
select is((select count(*)::integer from public.meal_plan_entries where household_id=current_setting('test.race.household')::uuid and leftover_of_entry_id is not null),0,'the rejected race does not persist an invalid leftover');
select is((select date from public.meal_plan_entries where id=current_setting('test.race.source')::uuid),'2030-08-04'::date,'the accepted source move remains intact');

select extensions.dblink_exec('race_a','reset role');
select extensions.dblink_exec('race_a',format('delete from public.households where id=%L; delete from auth.users where id=%L;',current_setting('test.race.household'),current_setting('test.race.member')));
select extensions.dblink_disconnect('race_b');
select extensions.dblink_disconnect('race_a');
select * from finish();
rollback;
