begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000311','signout-one@example.invalid'),
 ('00000000-0000-4000-8000-000000000312','signout-partner@example.invalid'),
 ('00000000-0000-4000-8000-000000000313','signout-other@example.invalid'),
 ('00000000-0000-4000-8000-000000000314','signout-nonmember@example.invalid');
insert into public.households(id,name) values
 ('10000000-0000-4000-8000-000000000311','Sign-out household'),
 ('10000000-0000-4000-8000-000000000312','Other household');
insert into public.household_members(household_id,user_id,display_name) values
 ('10000000-0000-4000-8000-000000000311','00000000-0000-4000-8000-000000000311','One'),
 ('10000000-0000-4000-8000-000000000311','00000000-0000-4000-8000-000000000312','Partner'),
 ('10000000-0000-4000-8000-000000000312','00000000-0000-4000-8000-000000000313','Other');

select ok(not has_function_privilege('anon','public.pause_my_push_for_signout()','execute'),
 'anonymous clients cannot pause notifications');
select ok(has_function_privilege('authenticated','public.pause_my_push_for_signout()','execute'),
 'signed-in members can invoke the fallback');
select ok(not has_table_privilege('authenticated','public.push_subscriptions','UPDATE'),
 'the fallback does not grant direct subscription mutations');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000311',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select public.register_push_subscription('https://push.example.invalid/signout-one','key-one','auth-one','pgTAP');
select public.register_push_subscription('https://push.example.invalid/signout-two','key-two','auth-two','pgTAP');
select public.register_push_subscription('https://push.example.invalid/signout-old','key-old','auth-old','pgTAP');
select public.unregister_push_subscription('https://push.example.invalid/signout-old');
reset role;
-- A historical disabled timestamp must survive retries of this fallback.
update public.push_subscriptions set disabled_at='2026-01-01T00:00:00Z',last_seen_at='2026-01-01T00:00:00Z'
 where endpoint='https://push.example.invalid/signout-old';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000312',true);
set local role authenticated;
select public.register_push_subscription('https://push.example.invalid/signout-partner','key-partner','auth-partner','pgTAP');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000313',true);
set local role authenticated;
select public.register_push_subscription('https://push.example.invalid/signout-other','key-other','auth-other','pgTAP');
reset role;
create temporary table signout_original as select * from public.push_subscriptions where endpoint like 'https://push.example.invalid/signout-%';

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000314',true);
set local role authenticated;
select throws_ok($$select public.pause_my_push_for_signout()$$,'42501','Household membership required','nonmembers cannot pause push');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.pause_my_push_for_signout()$$,'42501','Household membership required','a missing actor cannot pause push');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000311',true);
select is((public.pause_my_push_for_signout()->>'disabled')::integer,2,'unknown-device fallback pauses both active devices of the actor');
select is((public.pause_my_push_for_signout()->>'disabled')::integer,0,'retry is idempotent and preserves already-disabled rows');
select is(public.pause_my_push_for_signout(),'{"disabled":0}'::jsonb,'historically disabled subscriptions do not create a new pause notice');
select is((public.unregister_push_subscription('https://push.example.invalid/signout-partner')->>'disabled')::integer,0,'partner endpoint cleanup never authorizes browser unsubscribe');
reset role;

select is((select count(*)::integer from public.push_subscriptions where member_id='00000000-0000-4000-8000-000000000311' and disabled_at is null),0,'the signed-out member has no active delivery endpoints');
select is((select count(*)::integer from public.push_subscriptions s join signout_original o using(id)
 where s.member_id<>'00000000-0000-4000-8000-000000000311' and to_jsonb(s)=to_jsonb(o)),2,'partner and foreign-household subscriptions remain entirely unchanged');
select is((select disabled_at from public.push_subscriptions where endpoint='https://push.example.invalid/signout-old'),'2026-01-01T00:00:00Z'::timestamptz,'a historical disabled timestamp is preserved');
select is((select last_seen_at from public.push_subscriptions where endpoint='https://push.example.invalid/signout-old'),'2026-01-01T00:00:00Z'::timestamptz,'a historical last-seen timestamp is preserved');
select ok(not exists(select 1 from public.push_subscriptions s join signout_original o using(id)
 where (to_jsonb(s)-'disabled_at'-'last_seen_at') is distinct from (to_jsonb(o)-'disabled_at'-'last_seen_at')),'keys, endpoint identity and ownership are preserved');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000311',true);
set local role authenticated;
select public.register_push_subscription('https://push.example.invalid/signout-one','key-one','auth-one','pgTAP');
reset role;
select is((select count(*)::integer from public.push_subscriptions where member_id='00000000-0000-4000-8000-000000000311' and disabled_at is null),1,'reconnecting one device re-enables only that device');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000312',true);
set local role authenticated;
select is((public.pause_my_push_for_signout()->>'disabled')::integer,1,'the partner fallback affects only their own endpoint');
reset role;
select is((select count(*)::integer from public.push_subscriptions where member_id='00000000-0000-4000-8000-000000000311' and disabled_at is null),1,'partner sign-out leaves the reconnected device active');
select * from finish();
rollback;
