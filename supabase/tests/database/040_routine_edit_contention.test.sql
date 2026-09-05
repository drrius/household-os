-- Two ordinary sessions against the disposable local/CI database. Random committed
-- fixtures are visible to both sessions and explicitly removed at the end.
begin;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select no_plan();
select set_config('test.race.household',gen_random_uuid()::text,true);
select set_config('test.race.member',gen_random_uuid()::text,true);
select set_config('test.race.partner',gen_random_uuid()::text,true);
select set_config('test.race.area',gen_random_uuid()::text,true);
select extensions.dblink_connect('routine_a','host=supabase_db_household-os port=5432 user=postgres password=postgres dbname='||current_database());
select extensions.dblink_connect('routine_b','host=supabase_db_household-os port=5432 user=postgres password=postgres dbname='||current_database());
select extensions.dblink_exec('routine_a',format($setup$
 insert into auth.users(id,email) values (%1$L,%1$L||'@routine-race.example.invalid'),(%4$L,%4$L||'@routine-race.example.invalid');
 insert into public.households(id,name) values (%2$L,'Routine race fixture');
 insert into public.household_members(household_id,user_id,display_name) values (%2$L,%1$L,'Race member'),(%2$L,%4$L,'Race partner');
 insert into public.areas(id,household_id,name,sort_order) values (%3$L,%2$L,'Race area',1);
$setup$,current_setting('test.race.member'),current_setting('test.race.household'),current_setting('test.race.area'),current_setting('test.race.partner')));
select * from extensions.dblink('routine_a',format('select set_config(''request.jwt.claim.sub'',%L,false)',current_setting('test.race.member'))) as result(value text);
select * from extensions.dblink('routine_b',format('select set_config(''request.jwt.claim.sub'',%L,false)',current_setting('test.race.partner'))) as result(value text);
select extensions.dblink_exec('routine_a','set statement_timeout=''5s''; set role authenticated');
select extensions.dblink_exec('routine_b','set statement_timeout=''5s''; set role authenticated');
select * from extensions.dblink('routine_a',format($create$
 select public.create_routine(p_household_id=>%L,p_title=>'Contended routine',p_area_id=>%L,
 p_assignment_policy=>'shared',p_schedule_kind=>'calendar',p_schedule_rule=>'{"kind":"daily"}'::jsonb)
$create$,current_setting('test.race.household'),current_setting('test.race.area'))) as result(payload jsonb);
select set_config('test.race.routine',(select id::text from public.routines where household_id=current_setting('test.race.household')::uuid),true);
select set_config('test.race.pid',(select pid::text from extensions.dblink('routine_b','select pg_backend_pid()') as result(pid integer)),true);

create function pg_temp.routine_snapshot() returns jsonb language sql as $$
 select jsonb_build_object(
 'routine',(select to_jsonb(r) from public.routines r where id=current_setting('test.race.routine')::uuid),
 'occurrences',(select jsonb_agg(to_jsonb(o) order by id) from public.routine_occurrences o where routine_id=current_setting('test.race.routine')::uuid),
 'activity',(select count(*) from public.activity_events where household_id=current_setting('test.race.household')::uuid),
 'receipts',(select count(*) from private.routine_edit_receipts where household_id=current_setting('test.race.household')::uuid),
 'clear_intents',(select count(*) from private.routine_edit_clear_intents where household_id=current_setting('test.race.household')::uuid))
$$;
create function pg_temp.routine_edit_sql(command_key text, next_title text) returns text language sql as $$
 select format('select public.edit_routine_definition(%L,%L,%L,%L::jsonb)',
 current_setting('test.race.routine'),current_setting('test.race.version'),command_key,
 jsonb_build_object('title',next_title,'instructions',null))
$$;
create function pg_temp.wait_for_routine_lock(target integer) returns boolean language plpgsql as $$
begin
 for attempt in 1..100 loop
  perform pg_stat_clear_snapshot();
  if exists(select 1 from pg_stat_activity where pid=target and wait_event_type='Lock') then return true; end if;
  perform pg_sleep(0.01);
 end loop;
 return false;
end;
$$;

-- Window maintenance starts routine-first. An ordinary edit must release its
-- current-occurrence lock with 55P03 instead of waiting back on that routine.
select set_config('test.race.version',(select updated_at::text from public.routines where id=current_setting('test.race.routine')::uuid),true);
select set_config('test.race.before',pg_temp.routine_snapshot()::text,true);
select extensions.dblink_exec('routine_a','reset role; begin');
select * from extensions.dblink('routine_a',format('select id from public.routines where id=%L for update',current_setting('test.race.routine'))) as result(id uuid);
select throws_ok($$select * from extensions.dblink('routine_b',pg_temp.routine_edit_sql('040-window','After window contention')) as result(payload jsonb)$$,'55P03',null,'routine-first contention is retryable, not a deadlock or timeout');
select is(pg_temp.routine_snapshot(),current_setting('test.race.before')::jsonb,'rejected edit commits no routine, occurrence, activity, receipt or clear-intent change');
select lives_ok($$select * from extensions.dblink('routine_a',format('select private.ensure_routine_window(%L)',current_setting('test.race.routine'))) as result(value text)$$,'real window maintenance can acquire current and preview after the rejected edit');
select extensions.dblink_exec('routine_a','commit');
select lives_ok($$select * from extensions.dblink('routine_b',pg_temp.routine_edit_sql('040-window','After window contention')) as result(payload jsonb)$$,'identical request and key succeed after releasing the routine lock');
select is((select title from public.routines where id=current_setting('test.race.routine')::uuid),'After window contention','the retried edit persists');

-- A later preview lock must also fail without retaining either earlier lock.
select set_config('test.race.version',(select updated_at::text from public.routines where id=current_setting('test.race.routine')::uuid),true);
select set_config('test.race.before',pg_temp.routine_snapshot()::text,true);
select extensions.dblink_exec('routine_a','begin');
select * from extensions.dblink('routine_a',format('select id from public.routine_occurrences where routine_id=%L and role=''preview'' and status=''open'' for update',current_setting('test.race.routine'))) as result(id uuid);
select throws_ok($$select * from extensions.dblink('routine_b',pg_temp.routine_edit_sql('040-preview','After preview contention')) as result(payload jsonb)$$,'55P03',null,'preview contention is retryable, not a deadlock or timeout');
select is(pg_temp.routine_snapshot(),current_setting('test.race.before')::jsonb,'preview rejection also commits no partial state or consumed key');
select extensions.dblink_exec('routine_a','commit');
select lives_ok($$select * from extensions.dblink('routine_b',pg_temp.routine_edit_sql('040-preview','After preview contention')) as result(payload jsonb)$$,'the same preview-conflicted request and key succeed on retry');

-- Actual completion owns current -> routine -> preview while the editor waits.
-- Completion does not change the definition version, so the waiting edit saves
-- against the new occurrence window once completion commits.
select set_config('test.race.version',(select updated_at::text from public.routines where id=current_setting('test.race.routine')::uuid),true);
select set_config('test.race.current',(select id::text from public.routine_occurrences where routine_id=current_setting('test.race.routine')::uuid and role='current' and status='open'),true);
select extensions.dblink_exec('routine_a','set role authenticated; begin');
select * from extensions.dblink('routine_a',format('select public.complete_occurrence(%L,''040-close'',(timezone(''Europe/Zurich'',now()))::date)',current_setting('test.race.current'))) as result(payload jsonb);
select is(extensions.dblink_send_query('routine_b',pg_temp.routine_edit_sql('040-closure','After concurrent completion')),1,'ordinary edit starts before completion commits');
select ok(pg_temp.wait_for_routine_lock(current_setting('test.race.pid')::integer),'the editor actually reaches the held occurrence lock');
select extensions.dblink_exec('routine_a','commit');
select lives_ok($$select * from extensions.dblink_get_result('routine_b') as result(payload jsonb)$$,'waiting edit completes after closure without a deadlock or timeout');
select * from extensions.dblink_get_result('routine_b') as result(payload jsonb);
select is((select title from public.routines where id=current_setting('test.race.routine')::uuid),'After concurrent completion','waiting edit saves the accepted definition');
select is((select count(*)::integer from public.routine_completions where household_id=current_setting('test.race.household')::uuid),1,'the edit preserves the concurrent completion');
select is((select count(*)::integer from public.routine_occurrences where routine_id=current_setting('test.race.routine')::uuid and status='open' and role='current'),1,'exactly one current occurrence remains');
select is((select count(*)::integer from public.routine_occurrences where routine_id=current_setting('test.race.routine')::uuid and status='open' and role='preview'),1,'exactly one preview remains');
select is((select count(*)::integer from private.routine_edit_receipts where household_id=current_setting('test.race.household')::uuid),3,'only the three accepted logical edits consume keys');

select extensions.dblink_exec('routine_a','reset role');
select extensions.dblink_exec('routine_a',format('delete from private.routine_edit_receipts where household_id=%1$L; delete from public.routine_completions where household_id=%1$L; delete from public.households where id=%1$L; delete from auth.users where id in (%2$L,%3$L);',current_setting('test.race.household'),current_setting('test.race.member'),current_setting('test.race.partner')));
select extensions.dblink_disconnect('routine_b');
select extensions.dblink_disconnect('routine_a');
select * from finish();
rollback;
