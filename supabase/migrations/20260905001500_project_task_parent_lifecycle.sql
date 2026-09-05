-- Serialize task writes with parent archive/restore, including direct authenticated writes.
create function private.guard_project_task_parent_state()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  parent_archived timestamptz;
begin
  if auth.uid() is not null and not private.is_household_member(new.household_id) then
    raise exception 'project unavailable' using errcode = '42501';
  end if;
  select archived_at into parent_archived
    from public.household_projects
    where household_id = new.household_id and id = new.project_id
    for update;
  if not found then
    raise exception 'project unavailable' using errcode = '42501';
  end if;
  if parent_archived is not null then
    raise exception 'Restore this plan before changing tasks.' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_project_task_parent_state() from public, anon, authenticated;
create trigger project_tasks_parent_state before insert or update on public.project_tasks
  for each row execute function private.guard_project_task_parent_state();
