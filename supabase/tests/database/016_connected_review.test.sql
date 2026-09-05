begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000001601','review-a@example.invalid'),
 ('00000000-0000-4000-8000-000000001602','review-b@example.invalid');
insert into public.households(id,name) values
 ('00000000-0000-4000-8000-000000001610','Review home'),
 ('00000000-0000-4000-8000-000000001611','Other home');
insert into public.household_members(household_id,user_id,display_name) values
 ('00000000-0000-4000-8000-000000001610','00000000-0000-4000-8000-000000001601','Member'),
 ('00000000-0000-4000-8000-000000001611','00000000-0000-4000-8000-000000001602','Other member');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001601',true);
set local role authenticated;
insert into public.household_projects(id,household_id,kind,title) values
 ('00000000-0000-4000-8000-000000001620','00000000-0000-4000-8000-000000001610','trip','First trip'),
 ('00000000-0000-4000-8000-000000001621','00000000-0000-4000-8000-000000001610','trip','Second trip');
insert into public.calendar_events(id,household_id,title,starts_at,ends_at,project_id) values
 ('00000000-0000-4000-8000-000000001630','00000000-0000-4000-8000-000000001610','Departure','2026-10-01T08:00:00Z','2026-10-01T09:00:00Z','00000000-0000-4000-8000-000000001620');
select throws_ok($$insert into public.trip_bookings(household_id,project_id,title,kind,calendar_event_id) values ('00000000-0000-4000-8000-000000001610','00000000-0000-4000-8000-000000001621','Wrong trip','flight','00000000-0000-4000-8000-000000001630')$$,'23503',null,'booking cannot reference another trip calendar event');
insert into public.trip_bookings(id,household_id,project_id,title,kind,calendar_event_id) values
 ('00000000-0000-4000-8000-000000001640','00000000-0000-4000-8000-000000001610','00000000-0000-4000-8000-000000001620','Flight','flight','00000000-0000-4000-8000-000000001630');
select throws_ok($$update public.trip_bookings set project_id='00000000-0000-4000-8000-000000001621' where id='00000000-0000-4000-8000-000000001640'$$,'23503',null,'moving a booking cannot disagree with its event');
select throws_ok($$update public.calendar_events set project_id='00000000-0000-4000-8000-000000001621' where id='00000000-0000-4000-8000-000000001630'$$,'23503',null,'moving an event cannot disagree with its booking');
select throws_ok($$update public.calendar_events set project_id=null where id='00000000-0000-4000-8000-000000001630'$$,'23503',null,'linked event retains its project context');
insert into public.project_tasks(household_id,project_id,title) values ('00000000-0000-4000-8000-000000001610','00000000-0000-4000-8000-000000001620','Pack');
insert into public.household_decisions(id,household_id,title) values
 ('00000000-0000-4000-8000-000000001650','00000000-0000-4000-8000-000000001610',repeat(' ',160)||'Weekend away');
select lives_ok($$select public.convert_household_decision('00000000-0000-4000-8000-000000001650','trip')$$,'conversion trims valid whitespace-prefixed title');
select is((select p.title from public.household_projects p join public.household_decisions d on d.converted_project_id=p.id where d.id='00000000-0000-4000-8000-000000001650'),'Weekend away','converted title preserves the meaningful text');
select throws_ok($$delete from public.households where id='00000000-0000-4000-8000-000000001610'$$,'42501',null,'ordinary members cannot reset the household');
reset role;

select is((select count(*) from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
 where n.nspname='public' and c.contype='f' and c.confrelid='public.households'::regclass and c.confdeltype='c'
 and t.relname=any(array['household_projects','household_contacts','household_assets','household_commitments','project_tasks','calendar_events','trip_bookings','household_decisions','decision_options','household_financial_links','asset_maintenance','asset_routines','household_documents'])),13::bigint,'every connected aggregate cascades only from the tenant root');
select lives_ok($$delete from public.households where id='00000000-0000-4000-8000-000000001610'$$,'administrator can delete a connected household with no financial history');
select is((select count(*) from public.household_projects where household_id='00000000-0000-4000-8000-000000001610'),0::bigint,'projects and converted decisions cascade');
select is((select count(*) from public.trip_bookings where household_id='00000000-0000-4000-8000-000000001610'),0::bigint,'bookings cascade');
select is((select count(*) from public.calendar_events where household_id='00000000-0000-4000-8000-000000001610'),0::bigint,'events cascade');
select is((select count(*) from public.project_tasks where household_id='00000000-0000-4000-8000-000000001610'),0::bigint,'tasks cascade');
select is((select count(*) from public.households where id='00000000-0000-4000-8000-000000001611'),1::bigint,'other households survive');
select * from finish();
rollback;
