begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select ok((select relrowsecurity from pg_class where oid = 'public.device_push_test_requests'::regclass), 'quota evidence has RLS');
select ok(not has_table_privilege('authenticated', 'public.device_push_test_requests', 'delete'), 'clients cannot erase quota evidence');
select ok(not has_table_privilege('authenticated', 'public.device_push_test_requests', 'select'), 'quota rows are not exposed');
select ok(not has_function_privilege('anon', 'public.enqueue_self_device_push_test(text,uuid)', 'execute'), 'anonymous enqueue denied');
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000021','push-one@example.invalid'), ('00000000-0000-4000-8000-000000000022','push-two@example.invalid');
insert into public.households(id,name) values ('10000000-0000-4000-8000-000000000021','Push tests');
insert into public.household_members(household_id,user_id,display_name) values ('10000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000021','One'),('10000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000022','Two');
insert into public.push_subscriptions(id,household_id,member_id,endpoint,p256dh,auth) values
  ('20000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000021','https://push.example/one','pk','ak'),
  ('20000000-0000-4000-8000-000000000022','10000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000022','https://push.example/two','pk','ak');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000021', true);
set local role authenticated;

select throws_ok($$select public.enqueue_self_device_push_test('https://push.example/two','30000000-0000-4000-8000-000000000021')$$,'22023','Enable push on this device first','cannot target partner endpoint');
select is(public.enqueue_self_device_push_test('https://push.example/one','30000000-0000-4000-8000-000000000021')->>'status','queued','explicit test queues');
select is(public.enqueue_self_device_push_test('https://push.example/one','30000000-0000-4000-8000-000000000021')->>'id','30000000-0000-4000-8000-000000000021','same request retry returns same job');
select throws_ok($$select public.enqueue_self_device_push_test('https://push.example/one','30000000-0000-4000-8000-000000000022')$$,'22023','Wait one minute before testing this device again','one-minute quota');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000022', true);
set local role authenticated;

select throws_ok($$select public.enqueue_self_device_push_test('https://push.example/two','30000000-0000-4000-8000-000000000021')$$,'22023','Test request could not be used','UUID conflict does not return partner job');
select throws_ok($$select public.read_self_device_push_test('https://push.example/one','30000000-0000-4000-8000-000000000021')$$,'42501','Test not available for this device','cannot inspect partner job');
reset role;
select is((select count(*) from public.inbox_notifications where household_id='10000000-0000-4000-8000-000000000021'),0::bigint,'tests create no Inbox messages');
select is((select count(*) from public.push_outbox where id='30000000-0000-4000-8000-000000000021'),1::bigint,'retry creates only one job');
select throws_ok($$insert into public.push_outbox(household_id,recipient_member_id,test_subscription_id) values ('10000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000021','20000000-0000-4000-8000-000000000022')$$,'23503',null,'composite FK rejects another member device');
select throws_ok($$insert into public.push_outbox(household_id,recipient_member_id) values ('10000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000021')$$,'23514',null,'job requires exactly one source');
create temp table test_claim as select * from public.claim_push_outbox(100) where id='30000000-0000-4000-8000-000000000021';
select is((select inbox->>'test_subscription_id' from test_claim),'20000000-0000-4000-8000-000000000021','claim retains exact device without Inbox row');
select is((select inbox->>'kind' from test_claim),'device_test','claim carries explicit test kind');
select throws_ok($$select public.finalize_push_outbox_claim('30000000-0000-4000-8000-000000000021',(select claim_token from test_claim),'sent',null,array['20000000-0000-4000-8000-000000000022']::uuid[])$$,'22023','delivered subscription is not the test device','cannot accept a different device for this test');
select ok(public.finalize_push_outbox_claim('30000000-0000-4000-8000-000000000021',(select claim_token from test_claim),'sent',null,array['20000000-0000-4000-8000-000000000021']::uuid[]),'normal claim finalizer accepts test');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000021', true);
set local role authenticated;

select is(public.read_self_device_push_test('https://push.example/one','30000000-0000-4000-8000-000000000021')->>'status','accepted','sent maps to service accepted, not device delivered');
reset role;
update public.device_push_test_requests set created_at=now()-interval '2 minutes' where id='30000000-0000-4000-8000-000000000021';
insert into public.device_push_test_requests(id,household_id,member_id,subscription_id,endpoint_hash,created_at)
select extensions.gen_random_uuid(),'10000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000021','20000000-0000-4000-8000-000000000021',extensions.digest('https://push.example/one','sha256'),now()-interval '2 hours' from generate_series(1,4);
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000021', true);
set local role authenticated;

select throws_ok($$select public.enqueue_self_device_push_test('https://push.example/one','30000000-0000-4000-8000-000000000022')$$,'22023','Five tests in 24 hours is the limit. Try again tomorrow','rolling member quota spans devices');
select lives_ok($$delete from public.push_subscriptions where id='20000000-0000-4000-8000-000000000021'$$,'owner can remove device');
reset role;
select is((select count(*) from public.push_outbox where id='30000000-0000-4000-8000-000000000021'),0::bigint,'deleted target removes job, never becomes broadcast');
select is((select count(*) from public.device_push_test_requests where member_id='00000000-0000-4000-8000-000000000021'),5::bigint,'deletion preserves rolling quota evidence');
insert into public.push_subscriptions(id,household_id,member_id,endpoint,p256dh,auth) values ('20000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000021','https://push.example/new','pk','ak');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000021', true);
set local role authenticated;

select throws_ok($$select public.enqueue_self_device_push_test('https://push.example/new','30000000-0000-4000-8000-000000000022')$$,'22023','Five tests in 24 hours is the limit. Try again tomorrow','re-enrollment cannot reset member quota');
reset role;
update public.device_push_test_requests set created_at=now()-interval '25 hours' where member_id='00000000-0000-4000-8000-000000000021';
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000021', true);
set local role authenticated;

select is(public.enqueue_self_device_push_test('https://push.example/new','30000000-0000-4000-8000-000000000022')->>'status','queued','quota expires after rolling day');
select public.unregister_push_subscription('https://push.example/new');
reset role;
select public.run_drain_push_outbox('drain_push_outbox:device-test:disabled:021',100);
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000021', true);
set local role authenticated;

select is(public.read_self_device_push_test('https://push.example/new','30000000-0000-4000-8000-000000000022')->>'status','failed','disabled test device is skipped despite partner active subscription');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000022', true);
set local role authenticated;
select public.enqueue_self_device_push_test('https://push.example/two','30000000-0000-4000-8000-000000000023');
select public.unregister_push_subscription('https://push.example/two');
delete from public.push_subscriptions where id='20000000-0000-4000-8000-000000000022';
reset role;
insert into public.push_subscriptions(id,household_id,member_id,endpoint,p256dh,auth) values
  ('20000000-0000-4000-8000-000000000024','10000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000022','https://push.example/two','pk','ak');
set local role authenticated;
select throws_ok($$select public.enqueue_self_device_push_test('https://push.example/two','30000000-0000-4000-8000-000000000024')$$,'22023','Wait one minute before testing this device again','endpoint quota survives subscription ID replacement');
reset role;
select * from finish();
rollback;
