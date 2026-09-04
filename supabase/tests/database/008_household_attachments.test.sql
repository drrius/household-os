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
select lives_ok($$insert into storage.objects (bucket_id, name) values ('household-files', '10000000-0000-4000-8000-000000000081/receipts/20000000-0000-4000-8000-000000000081.pdf')$$, 'member can insert into own household');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('household-files', '10000000-0000-4000-8000-000000000082/receipts/20000000-0000-4000-8000-000000000081.pdf')$$, '42501', null, 'cannot upload into another household');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('household-files', '10000000-0000-4000-8000-000000000081/../unscoped.pdf')$$, '42501', null, 'reject malformed paths');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000082', true);
select is((select count(*) from storage.objects where bucket_id = 'household-files'), 1::bigint, 'partner can read shared attachments');
update storage.objects set name = 'replacement.pdf' where bucket_id = 'household-files';
select is((select count(*) from storage.objects where bucket_id = 'household-files' and name like '%/receipts/%'), 1::bigint, 'receipt objects cannot be overwritten');
delete from storage.objects where bucket_id = 'household-files';
select is((select count(*) from storage.objects where bucket_id = 'household-files'), 1::bigint, 'receipt objects cannot be deleted');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000083', true);
select is((select count(*) from storage.objects where bucket_id = 'household-files'), 0::bigint, 'other household cannot read attachments');
set local role anon;
select is((select count(*) from storage.objects where bucket_id = 'household-files'), 0::bigint, 'anonymous users cannot read attachments');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('household-files', '10000000-0000-4000-8000-000000000081/documents/20000000-0000-4000-8000-000000000082.pdf')$$, '42501', null, 'anonymous users cannot upload');
reset role;
select * from finish();
rollback;
