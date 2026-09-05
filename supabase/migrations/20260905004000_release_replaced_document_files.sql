-- Replaced documents may release a file only after its last reference is gone.
-- Claims and cleanup already lock this registry row; rechecking after that lock
-- serializes a release with concurrent claims without touching financial history.
create function private.lock_replaced_household_files()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null and not private.is_household_member(new.household_id) then
    raise exception 'Attachment access denied' using errcode='42501';
  end if;
  -- Acquire both old and new files before the claim trigger. Concurrent swaps
  -- otherwise lock each other's destination and deadlock while releasing source.
  perform 1 from public.household_attachment_uploads
    where household_id=new.household_id
      and path in (to_jsonb(old)->>tg_argv[0],to_jsonb(new)->>tg_argv[0])
    order by path for update;
  return new;
end;
$$;
revoke all on function private.lock_replaced_household_files() from public,anon,authenticated;
create trigger ab_lock_replaced_household_files before update of file_path on public.household_documents
  for each row execute function private.lock_replaced_household_files('file_path');
create trigger ab_lock_replaced_household_files before update of photo_path on public.pets
  for each row execute function private.lock_replaced_household_files('photo_path');
create trigger ab_lock_replaced_household_files before update of photo_path on public.household_members
  for each row execute function private.lock_replaced_household_files('photo_path');

create function private.release_replaced_household_file()
returns trigger language plpgsql security definer set search_path='' as $$
declare previous_path text := to_jsonb(old)->>tg_argv[0];
begin
  if previous_path is null or (to_jsonb(new)->>tg_argv[0]) is not distinct from previous_path then return new; end if;
  perform 1 from public.household_attachment_uploads
    where path=previous_path and household_id=old.household_id and state='claimed'
    for update;
  if not found then return new; end if;
  if not exists(select 1 from public.household_documents where file_path=previous_path)
    and not exists(select 1 from public.financial_events where receipt_path=previous_path)
    and not exists(select 1 from public.shopping_sessions where receipt_path=previous_path)
    and not exists(select 1 from public.routine_completions where photo_path=previous_path)
    and not exists(select 1 from public.pets where photo_path=previous_path)
    and not exists(select 1 from public.household_members where photo_path=previous_path)
  then
    -- created_at is the pending-cleanup age anchor. Restart its grace period so
    -- a previously old upload gets the same 24-hour recovery window as a new one.
    update public.household_attachment_uploads set state='pending',created_at=clock_timestamp()
      where path=previous_path and household_id=old.household_id;
  end if;
  return new;
end;
$$;
revoke all on function private.release_replaced_household_file() from public,anon,authenticated;
create trigger release_replaced_document_file after update of file_path on public.household_documents
  for each row execute function private.release_replaced_household_file('file_path');

-- Legacy profile fields can also reference these private files. Keep those
-- references under the same claim lock; unrelated legacy photo values are left
-- alone. Without this, a profile write could race the reference check above.
create function private.claim_profile_household_file()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.photo_path is null or (tg_op='UPDATE' and new.photo_path is not distinct from old.photo_path) then
    return new;
  end if;
  if new.photo_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(receipts|completions|documents)/' then
    perform private.claim_household_attachment(new.photo_path,new.household_id);
  end if;
  return new;
end;
$$;
revoke all on function private.claim_profile_household_file() from public,anon,authenticated;
create trigger claim_profile_household_file before insert or update of photo_path on public.pets
  for each row execute function private.claim_profile_household_file();
create trigger claim_profile_household_file before insert or update of photo_path on public.household_members
  for each row execute function private.claim_profile_household_file();

create trigger release_replaced_profile_file after update of photo_path on public.pets
  for each row execute function private.release_replaced_household_file('photo_path');
create trigger release_replaced_profile_file after update of photo_path on public.household_members
  for each row execute function private.release_replaced_household_file('photo_path');
