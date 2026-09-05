create function private.guard_archived_project_edits()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.archived_at is not null
    and (to_jsonb(new) - array['archived_at','updated_at'])
      is distinct from (to_jsonb(old) - array['archived_at','updated_at']) then
    raise exception 'Restore this plan before editing its details.' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_archived_project_edits() from public, anon, authenticated;
create trigger household_projects_archive_guard before update on public.household_projects
  for each row execute function private.guard_archived_project_edits();

create function private.guard_project_task_parent_identity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.project_id is distinct from old.project_id then
    raise exception 'A task belongs to its original plan.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_project_task_parent_identity() from public, anon, authenticated;
create trigger project_tasks_immutable_parent before update on public.project_tasks
  for each row execute function private.guard_project_task_parent_identity();
