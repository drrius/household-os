-- Private household attachments. Object names are immutable so financial
-- receipt links cannot be replaced behind an append-only ledger event.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('household-files', 'household-files', false, 4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy household_files_read on storage.objects for select to authenticated
using (
  bucket_id = 'household-files'
  and exists (
    select 1 from public.household_members member
    where member.user_id = (select auth.uid())
      and member.household_id::text = split_part(name, '/', 1)
  )
);

create policy household_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'household-files'
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(receipts|completions|documents)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$'
  and exists (
    select 1 from public.household_members member
    where member.user_id = (select auth.uid())
      and member.household_id::text = split_part(name, '/', 1)
  )
);
