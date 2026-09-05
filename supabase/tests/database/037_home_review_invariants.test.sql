begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,email) values
 ('37000000-0000-4000-8000-000000000001','review-a@example.invalid'),
 ('37000000-0000-4000-8000-000000000002','review-b@example.invalid'),
 ('37000000-0000-4000-8000-000000000003','review-c@example.invalid');
insert into public.households(id,name) values
 ('37000000-0000-4000-8000-000000000100','Review household'),
 ('37000000-0000-4000-8000-000000000200','Foreign household');
insert into public.household_members(household_id,user_id,display_name) values
 ('37000000-0000-4000-8000-000000000100','37000000-0000-4000-8000-000000000001','A'),
 ('37000000-0000-4000-8000-000000000100','37000000-0000-4000-8000-000000000002','B'),
 ('37000000-0000-4000-8000-000000000200','37000000-0000-4000-8000-000000000003','C');
insert into public.household_assets(household_id,created_by,title,warranty_until)
 select '37000000-0000-4000-8000-000000000100','37000000-0000-4000-8000-000000000001','Device ' || n,date '2026-09-05'+n from generate_series(1,21) n;
insert into public.household_assets(household_id,created_by,title,warranty_until,archived_at) values
 ('37000000-0000-4000-8000-000000000100','37000000-0000-4000-8000-000000000001','100% washer','2026-09-05',null),
 ('37000000-0000-4000-8000-000000000100','37000000-0000-4000-8000-000000000001','Archived device','2026-09-05',now()),
 ('37000000-0000-4000-8000-000000000100','37000000-0000-4000-8000-000000000001','Expired device','2026-09-04',null),
 ('37000000-0000-4000-8000-000000000100','37000000-0000-4000-8000-000000000001','Later device','2026-10-06',null),
 ('37000000-0000-4000-8000-000000000200','37000000-0000-4000-8000-000000000003','Foreign device','2026-09-05',null);
insert into public.household_commitments(household_id,created_by,title,renewal_on,notice_days,status) values
 ('37000000-0000-4000-8000-000000000100','37000000-0000-4000-8000-000000000001','Due notice','2026-12-01',60,'active'),
 ('37000000-0000-4000-8000-000000000100','37000000-0000-4000-8000-000000000001','Ended notice','2026-09-05',0,'ended'),
 ('37000000-0000-4000-8000-000000000100','37000000-0000-4000-8000-000000000001','Later notice','2026-12-01',0,'active');
insert into public.household_decisions(id,household_id,created_by,title) values
 ('37000000-0000-4000-8000-000000000010','37000000-0000-4000-8000-000000000100','37000000-0000-4000-8000-000000000001','Trip ideas');
insert into public.decision_options(id,household_id,created_by,decision_id,title) values
 ('37000000-0000-4000-8000-000000000020','37000000-0000-4000-8000-000000000100','37000000-0000-4000-8000-000000000001','37000000-0000-4000-8000-000000000010','Train');
select set_config('request.jwt.claim.sub','37000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((public.list_home_attention_records('inventory','',0,'2026-09-05')->>'count')::integer,22,'count excludes archived, expired, distant and foreign assets');
select is(jsonb_array_length(public.list_home_attention_records('inventory','',0,'2026-09-05')->'rows'),20,'first attention page is bounded');
select is(jsonb_array_length(public.list_home_attention_records('inventory','',1,'2026-09-05')->'rows'),2,'second attention page retains remaining records');
select is(public.list_home_attention_records('inventory','',0,'2026-09-05')->'rows'->0->>'title','100% washer','deadline order precedes identity order');
select is((public.list_home_attention_records('inventory','%',0,'2026-09-05')->>'count')::integer,1,'search treats percent as literal text');
select is((public.list_home_attention_records('commitments','',0,'2026-09-05')->>'count')::integer,1,'notice deadline rather than renewal determines attention');
select throws_ok($$select public.list_home_attention_records('inventory','',-1,'2026-09-05')$$,'23514','Invalid attention query','negative pages are rejected');
select public.choose_household_decision_option('37000000-0000-4000-8000-000000000010','37000000-0000-4000-8000-000000000020');
select set_config('test.option.version',(select updated_at::text from public.decision_options where id='37000000-0000-4000-8000-000000000020'),true);
select set_config('request.jwt.claim.sub','37000000-0000-4000-8000-000000000002',true);
update public.decision_options set title='Partner prefers the train' where id='37000000-0000-4000-8000-000000000020';
select ok((select updated_at > current_setting('test.option.version')::timestamptz from public.decision_options where id='37000000-0000-4000-8000-000000000020'),'multiple writes in one transaction advance the edit version');
update public.decision_options set updated_at='2099-01-01' where id='37000000-0000-4000-8000-000000000020';
select ok((select updated_at < '2099-01-01'::timestamptz from public.decision_options where id='37000000-0000-4000-8000-000000000020'),'members cannot forge the authoritative edit version');
select throws_ok($$select public.archive_household_decision_option_versioned('37000000-0000-4000-8000-000000000020',true,current_setting('test.option.version')::timestamptz)$$,'40001','This option changed. Reload before trying again','stale archive does not overwrite a partner edit');
select is((select archived_at from public.decision_options where id='37000000-0000-4000-8000-000000000020'),null::timestamptz,'rejected archive leaves the option active');
select lives_ok($$select public.archive_household_decision_option_versioned('37000000-0000-4000-8000-000000000020',true,(select updated_at from public.decision_options where id='37000000-0000-4000-8000-000000000020'))$$,'fresh archive retains the atomic choice lifecycle');
select is((select chosen from public.decision_options where id='37000000-0000-4000-8000-000000000020'),false,'archiving clears the choice');
select is((select status from public.household_decisions where id='37000000-0000-4000-8000-000000000010'),'considering','archiving the choice updates its parent');
select set_config('request.jwt.claim.sub','37000000-0000-4000-8000-000000000003',true);
select is((public.list_home_attention_records('inventory','',0,'2026-09-05')->>'count')::integer,1,'a different member sees only their household count');
select throws_ok($$select public.archive_household_decision_option_versioned('37000000-0000-4000-8000-000000000020',false,now())$$,'42501','Option not found','versioned archive preserves tenant isolation');
select * from finish();
rollback;
