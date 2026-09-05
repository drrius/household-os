-- Preserve decision lifecycle even through an older RPC or direct table update.
create function private.guard_archived_decision_choice()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_archived_at timestamptz;
begin
  select archived_at into v_archived_at from public.household_decisions
    where id = new.decision_id and household_id = new.household_id for update;
  if not found then raise exception 'Decision not found' using errcode = '42501'; end if;
  if v_archived_at is not null then
    raise exception 'Restore this decision before changing its choice' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_archived_decision_choice() from public, anon, authenticated;
create trigger guard_archived_decision_choice before update of chosen on public.decision_options
for each row execute function private.guard_archived_decision_choice();

create function private.guard_archived_decision_status()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.archived_at is not null and new.archived_at is not null then
    raise exception 'Restore this decision before changing its status' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_archived_decision_status() from public, anon, authenticated;
create trigger guard_archived_decision_status before update of status on public.household_decisions
for each row execute function private.guard_archived_decision_status();
