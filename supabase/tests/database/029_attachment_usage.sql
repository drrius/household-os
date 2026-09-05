begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,email) values
 ('a2900000-0000-4000-8000-000000000001','usage-a@example.invalid'),
 ('a2900000-0000-4000-8000-000000000002','usage-partner@example.invalid'),
 ('a2900000-0000-4000-8000-000000000003','usage-other@example.invalid'),
 ('a2900000-0000-4000-8000-000000000004','usage-nonmember@example.invalid');
insert into public.households(id,name) values
 ('a2900100-0000-4000-8000-000000000001','Usage home'),
 ('a2900100-0000-4000-8000-000000000002','Other usage');
insert into public.household_members(household_id,user_id,display_name) values
 ('a2900100-0000-4000-8000-000000000001','a2900000-0000-4000-8000-000000000001','A'),
 ('a2900100-0000-4000-8000-000000000001','a2900000-0000-4000-8000-000000000002','Partner'),
 ('a2900100-0000-4000-8000-000000000002','a2900000-0000-4000-8000-000000000003','Other');
select ok(not has_function_privilege('anon','public.household_attachment_usage()','EXECUTE'),'anonymous aggregate is unavailable');
select set_config('request.jwt.claim.sub','a2900000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is(public.household_attachment_usage(),'0','empty household reports an explicit zero');
select public.reserve_household_attachment('a2900100-0000-4000-8000-000000000001/receipts/a2900200-0000-4000-8000-000000000001.pdf','application/pdf');
select public.reserve_household_attachment('A2900100-0000-4000-8000-000000000001/documents/a2900200-0000-4000-8000-000000000002.pdf','application/pdf');
select throws_ok($$insert into storage.objects(bucket_id,name,metadata) values ('household-files','a2900100-0000-4000-8000-000000000001/receipts/a2900200-0000-4000-8000-000000000001.pdf','{"mimetype":"application/pdf","size":1}')$$,'42501',null,'usage support does not grant direct object writes');
select set_config('request.jwt.claim.sub','a2900000-0000-4000-8000-000000000003',true);
select public.reserve_household_attachment('a2900100-0000-4000-8000-000000000002/receipts/a2900200-0000-4000-8000-000000000003.pdf','application/pdf');
reset role;
-- Controlled metadata fixtures only: no actual file bytes are created or downloaded.
insert into storage.objects(bucket_id,name,metadata) values
 ('household-files','a2900100-0000-4000-8000-000000000001/receipts/a2900200-0000-4000-8000-000000000001.pdf','{"mimetype":"application/pdf","size":499999899}'),
 ('household-files','A2900100-0000-4000-8000-000000000001/documents/a2900200-0000-4000-8000-000000000002.pdf','{"mimetype":"application/pdf","size":"100"}'),
 ('household-files','a2900100-0000-4000-8000-000000000002/receipts/a2900200-0000-4000-8000-000000000003.pdf','{"mimetype":"application/pdf","size":700}');
insert into storage.buckets(id,name,public) values('usage-test-other','usage-test-other',false);
insert into storage.objects(bucket_id,name,metadata) values ('usage-test-other','a2900100-0000-4000-8000-000000000001/file.pdf','{"size":999999999}');
set local role authenticated;
select set_config('request.jwt.claim.sub','a2900000-0000-4000-8000-000000000001',true);
select is(public.household_attachment_usage(),'499999999','only the household bucket and exact case-insensitive UUID segment are counted');
select set_config('request.jwt.claim.sub','a2900000-0000-4000-8000-000000000002',true);
select is(public.household_attachment_usage(),'499999999','equal partner sees the same household total');
select set_config('request.jwt.claim.sub','a2900000-0000-4000-8000-000000000003',true);
select is(public.household_attachment_usage(),'700','other household sees only its own total');
select set_config('request.jwt.claim.sub','a2900000-0000-4000-8000-000000000004',true);
select throws_ok($$select public.household_attachment_usage()$$,'42501','Household membership required','authenticated nonmember cannot read any usage');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.household_attachment_usage()$$,'42501','Household membership required','authenticated role without identity cannot read usage');
reset role;
update storage.objects set metadata='{"mimetype":"application/pdf","size":499999900}' where name='a2900100-0000-4000-8000-000000000001/receipts/a2900200-0000-4000-8000-000000000001.pdf';
set local role authenticated;
select set_config('request.jwt.claim.sub','a2900000-0000-4000-8000-000000000001',true);
select is(public.household_attachment_usage(),'500000000','exact decimal warning threshold is preserved');
reset role;
update storage.objects set metadata='{"mimetype":"application/pdf","size":499999901}' where name='a2900100-0000-4000-8000-000000000001/receipts/a2900200-0000-4000-8000-000000000001.pdf';
update public.household_attachment_uploads set state='claimed' where path='a2900100-0000-4000-8000-000000000001/receipts/a2900200-0000-4000-8000-000000000001.pdf';
set local role authenticated;
select is(public.household_attachment_usage(),'500000001','usage includes retained claimed objects above the warning threshold');
reset role;
-- Larger-than-Number fixtures prove that the RPC transports exact integer strings.
update storage.objects set metadata=jsonb_build_object('mimetype','application/pdf','size','900719925474099312345') where name='a2900100-0000-4000-8000-000000000001/receipts/a2900200-0000-4000-8000-000000000001.pdf';
set local role authenticated;
select set_config('request.jwt.claim.sub','a2900000-0000-4000-8000-000000000001',true);
select is(public.household_attachment_usage(),'900719925474099312445','numeric sum is returned without JavaScript or bigint truncation');
reset role;
update storage.objects set metadata='{"mimetype":"application/pdf"}' where name='a2900100-0000-4000-8000-000000000001/receipts/a2900200-0000-4000-8000-000000000001.pdf';
set local role authenticated;
select is(public.household_attachment_usage(),null::text,'missing size makes usage unknown rather than undercounting');
reset role;
update storage.objects set metadata='{"mimetype":"application/pdf","size":"broken"}' where name='a2900100-0000-4000-8000-000000000001/receipts/a2900200-0000-4000-8000-000000000001.pdf';
set local role authenticated;
select is(public.household_attachment_usage(),null::text,'invalid size makes usage unknown without a cast error');
select set_config('request.jwt.claim.sub','a2900000-0000-4000-8000-000000000003',true);
select is(public.household_attachment_usage(),'700','bad metadata in another household does not affect own usage');
reset role;
select * from finish(); rollback;
