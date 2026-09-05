begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select is((select public from storage.buckets where id = 'household-files'), false, 'household bucket is private');
select is((select file_size_limit from storage.buckets where id = 'household-files'), 4194304::bigint, '4 MiB limit is enforced');

insert into auth.users (id, email) values
 ('00000000-0000-4000-8000-000000000081', 'files-one@example.invalid'),
 ('00000000-0000-4000-8000-000000000082', 'files-partner@example.invalid'),
 ('00000000-0000-4000-8000-000000000083', 'files-other@example.invalid');
insert into public.households (id, name) values
 ('10000000-0000-4000-8000-000000000081', 'Files home'),
 ('10000000-0000-4000-8000-000000000082', 'Other files home');
insert into public.household_members (household_id, user_id, display_name) values
 ('10000000-0000-4000-8000-000000000081', '00000000-0000-4000-8000-000000000081', 'One'),
 ('10000000-0000-4000-8000-000000000081', '00000000-0000-4000-8000-000000000082', 'Partner'),
 ('10000000-0000-4000-8000-000000000082', '00000000-0000-4000-8000-000000000083', 'Other');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000081', true);
select is(public.reserve_household_attachment('10000000-0000-4000-8000-000000000081/receipts/20000000-0000-4000-8000-000000000081.pdf', 'application/pdf'), false, 'reserve a new upload');
select throws_ok($$insert into storage.objects (bucket_id, name, metadata) values ('household-files', '10000000-0000-4000-8000-000000000081/receipts/20000000-0000-4000-8000-000000000081.pdf', '{"mimetype":"application/pdf"}')$$, '42501', null, 'registered clients cannot bypass the Edge byte inspection');
reset role;
insert into storage.objects (bucket_id,name,metadata) values ('household-files','10000000-0000-4000-8000-000000000081/receipts/20000000-0000-4000-8000-000000000081.pdf','{"mimetype":"application/pdf"}');
set local role authenticated;
select is(public.reserve_household_attachment('10000000-0000-4000-8000-000000000081/receipts/20000000-0000-4000-8000-000000000081.pdf', 'application/pdf'), true, 'lost upload response recovers existing object');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('household-files', '10000000-0000-4000-8000-000000000081/documents/20000000-0000-4000-8000-000000000082.pdf')$$, '22023', null, 'direct unregistered uploads rejected');
select throws_ok($$select public.reserve_household_attachment('10000000-0000-4000-8000-000000000082/receipts/20000000-0000-4000-8000-000000000081.pdf', 'application/pdf')$$, '22023', null, 'cross-household reservation rejected');
select throws_ok($$select public.reserve_household_attachment('10000000-0000-4000-8000-000000000081/completions/20000000-0000-4000-8000-000000000081.pdf', 'application/pdf')$$, '22023', null, 'completion PDFs rejected at database boundary');
select throws_ok($$insert into storage.objects (bucket_id,name,metadata) values ('household-files','10000000-0000-4000-8000-000000000081/completions/20000000-0000-4000-8000-000000000081.pdf','{"mimetype":"application/pdf"}')$$, '22023', null, 'direct Storage completion PDF rejected');
select public.reserve_household_attachment('10000000-0000-4000-8000-000000000081/completions/20000000-0000-4000-8000-000000000082.jpg', 'image/jpeg');
select throws_ok($$insert into storage.objects (bucket_id,name,metadata) values ('household-files','10000000-0000-4000-8000-000000000081/completions/20000000-0000-4000-8000-000000000082.jpg','{"mimetype":"application/pdf"}')$$, '22023', null, 'PDF MIME rejected even with reserved image extension');
select throws_ok($$insert into storage.objects(bucket_id,name,metadata) values ('household-files','10000000-0000-4000-8000-000000000081/completions/20000000-0000-4000-8000-000000000082.jpg','{"mimetype":"image/jpeg"}')$$,'42501',null,'matching forged image MIME cannot bypass Edge inspection');
reset role;
insert into storage.objects(bucket_id,name,metadata) values ('household-files','10000000-0000-4000-8000-000000000081/completions/20000000-0000-4000-8000-000000000082.jpg','{"mimetype":"image/jpeg"}');
set local role authenticated;
select throws_ok($$update public.household_attachment_uploads set state = 'claimed'$$, '42501', null, 'clients cannot bypass claim state machine');
select is_empty($$select * from public.begin_household_attachment_cleanup()$$, 'fresh pending uploads have a grace period');

-- A PDF in another valid purpose cannot be relabelled as a completion photo.
reset role;
select throws_ok($$insert into public.routine_completions(occurrence_id,household_id,completed_by_member_id,completed_on,photo_path) values (
'30000000-0000-4000-8000-000000000081','10000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000081',current_date,
'10000000-0000-4000-8000-000000000081/receipts/20000000-0000-4000-8000-000000000081.pdf')$$,'22023','Choose a completion photo','completion parent also rejects receipt PDFs');
set local role authenticated;

-- Exercise the actual parent trigger; cleanup must retain claimed receipts.
reset role;
insert into public.shopping_sessions(household_id, member_id, receipt_path) values (
 '10000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000081',
 '10000000-0000-4000-8000-000000000081/receipts/20000000-0000-4000-8000-000000000081.pdf');
set local role authenticated;
select is((select state from public.household_attachment_uploads where path like '%/receipts/%'), 'claimed', 'parent claims attachment atomically');
select is_empty($$select * from public.begin_household_attachment_cleanup('10000000-0000-4000-8000-000000000081/receipts/20000000-0000-4000-8000-000000000081.pdf')$$, 'cleanup after claim never marks immutable file');
select is((select count(*) from public.begin_household_attachment_cleanup('10000000-0000-4000-8000-000000000081/completions/20000000-0000-4000-8000-000000000082.jpg')), 1::bigint, 'explicit removal marks own pending file');
select is((select count(*) from public.begin_household_attachment_cleanup()), 1::bigint, 'interrupted deletion is retried immediately');
reset role;
select throws_ok($$select private.claim_household_attachment('10000000-0000-4000-8000-000000000081/completions/20000000-0000-4000-8000-000000000082.jpg','10000000-0000-4000-8000-000000000081')$$, '22023', null, 'claim after cleanup cannot create a broken link');
set local role authenticated;
select public.finish_household_attachment_cleanup('10000000-0000-4000-8000-000000000081/completions/20000000-0000-4000-8000-000000000082.jpg');
select is((select state from public.household_attachment_uploads where path like '%/completions/%'), 'deleting', 'cleanup cannot finish before Storage actually deletes object');
select throws_ok($$select public.reserve_household_attachment('10000000-0000-4000-8000-000000000081/completions/20000000-0000-4000-8000-000000000082.jpg','image/jpeg')$$, '22023', null, 'stale upload retry cannot resurrect removed object');

select public.reserve_household_attachment('10000000-0000-4000-8000-000000000081/documents/20000000-0000-4000-8000-000000000085.pdf','application/pdf');
select * from public.begin_household_attachment_cleanup('10000000-0000-4000-8000-000000000081/documents/20000000-0000-4000-8000-000000000085.pdf');
select public.finish_household_attachment_cleanup('10000000-0000-4000-8000-000000000081/documents/20000000-0000-4000-8000-000000000085.pdf');
reset role;
select throws_ok($$insert into storage.objects(bucket_id,name,metadata) values ('household-files','10000000-0000-4000-8000-000000000081/documents/20000000-0000-4000-8000-000000000085.pdf','{"mimetype":"application/pdf"}')$$,'22023',null,'privileged writer cannot resurrect an upload after cleanup');
set local role authenticated;
select is((select state from public.household_attachment_uploads where path like '%000000000085.pdf'), 'deleted', 'missing object cleanup finishes with tombstone');
select throws_ok($$select public.reserve_household_attachment('10000000-0000-4000-8000-000000000081/documents/20000000-0000-4000-8000-000000000085.pdf','application/pdf')$$, '22023', null, 'deleted tombstone prevents stale retry resurrection');
select public.reserve_household_attachment('10000000-0000-4000-8000-000000000081/documents/20000000-0000-4000-8000-000000000083.pdf','application/pdf');
reset role;
update public.household_attachment_uploads set created_at = now() - interval '25 hours' where path like '%/documents/%';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000082', true);
select is((select count(*) from storage.objects where bucket_id = 'household-files'), 2::bigint, 'partner can read shared attachments');
select is((select count(*) from public.begin_household_attachment_cleanup()), 2::bigint, 'partner reclaims aged uploads and resumes interrupted removals');
update storage.objects set name = 'replacement.pdf' where bucket_id = 'household-files';
select is((select count(*) from storage.objects where bucket_id = 'household-files' and name like '%/receipts/%'), 1::bigint, 'receipt objects cannot be overwritten');
select throws_like($$delete from storage.objects where bucket_id = 'household-files'$$, 'Direct deletion from storage tables is not allowed.%', 'cleanup must use the Storage API');
select is((select count(*) from public.household_attachment_uploads where state = 'deleting' and path like '%/receipts/%'), 0::bigint, 'linked receipt never satisfies Storage deletion policy');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000083', true);
select is((select count(*) from storage.objects where bucket_id = 'household-files'), 0::bigint, 'other household cannot read attachments');
select is((select count(*) from public.household_attachment_uploads), 0::bigint, 'registry tenant isolation');
select is_empty($$select * from public.begin_household_attachment_cleanup('10000000-0000-4000-8000-000000000081/documents/20000000-0000-4000-8000-000000000083.pdf')$$, 'cross-household cleanup does nothing');
set local role anon;
select is((select count(*) from storage.objects where bucket_id = 'household-files'), 0::bigint, 'anonymous users cannot read attachments');
select throws_ok($$select public.reserve_household_attachment('10000000-0000-4000-8000-000000000081/documents/20000000-0000-4000-8000-000000000084.pdf','application/pdf')$$, '42501', null, 'anonymous users cannot reserve');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000081', true);
select is(public.reserve_household_attachment('10000000-0000-4000-8000-000000000081/documents/20000000-0000-4000-8000-000000000099.PDF','application/pdf'),false,'uppercase extension maps to normalized MIME');
-- Valid inspected uploads cannot be repurposed as shopping or financial receipts.
select public.reserve_household_attachment('10000000-0000-4000-8000-000000000081/completions/20000000-0000-4000-8000-000000000090.jpg','image/jpeg');
select public.reserve_household_attachment('10000000-0000-4000-8000-000000000081/documents/20000000-0000-4000-8000-000000000091.pdf','application/pdf');
reset role;
insert into storage.objects(bucket_id,name,metadata) values
('household-files','10000000-0000-4000-8000-000000000081/completions/20000000-0000-4000-8000-000000000090.jpg','{"mimetype":"image/jpeg"}'),
('household-files','10000000-0000-4000-8000-000000000081/documents/20000000-0000-4000-8000-000000000091.pdf','{"mimetype":"application/pdf"}');
select throws_ok(format($sql$
  insert into public.shopping_sessions(household_id,member_id,finished_at,receipt_path)
  values ('10000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000081',now(),%L)
$sql$, path),'22023','Choose a receipt attachment','shopping rejects a valid ' || purpose || ' upload as its receipt')
from (values
 ('completions','10000000-0000-4000-8000-000000000081/completions/20000000-0000-4000-8000-000000000090.jpg'),
 ('documents','10000000-0000-4000-8000-000000000081/documents/20000000-0000-4000-8000-000000000091.pdf')
) as wrong_purpose(purpose,path);
select throws_ok(format($sql$
  insert into public.financial_events(household_id,type,occurred_on,created_by_member_id,payer_member_id,description,amount_cents,receipt_path)
  values ('10000000-0000-4000-8000-000000000081','expense',current_date,'00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000081','Receipt purpose fixture',0,%L)
$sql$, path),'22023','Choose a receipt attachment','financial event rejects a valid ' || purpose || ' upload as its receipt')
from (values
 ('completions','10000000-0000-4000-8000-000000000081/completions/20000000-0000-4000-8000-000000000090.jpg'),
 ('documents','10000000-0000-4000-8000-000000000081/documents/20000000-0000-4000-8000-000000000091.pdf')
) as wrong_purpose(purpose,path);
select lives_ok($sql$
  insert into public.shopping_sessions(household_id,member_id,finished_at,receipt_path)
  values ('10000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000081',now(),null)
$sql$,'shopping receipt remains optional');
select lives_ok($sql$
  insert into public.financial_events(household_id,type,occurred_on,created_by_member_id,payer_member_id,description,amount_cents,receipt_path)
  values ('10000000-0000-4000-8000-000000000081','expense',current_date,'00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000081','No receipt fixture',0,null)
$sql$,'financial receipt remains optional');
reset role;
select * from finish();
rollback;
