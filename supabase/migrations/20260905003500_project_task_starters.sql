-- A selected checklist is one atomic operation. The parent lock serializes retries,
-- concurrent additions and parent archive, without creating financial obligations.
create table private.project_starter_selections (
  task_id uuid primary key,
  household_id uuid not null,
  project_id uuid not null,
  payload jsonb not null,
  foreign key (household_id,project_id) references public.household_projects(household_id,id) on delete cascade
);
alter table private.project_starter_selections enable row level security;
revoke all on private.project_starter_selections from public,anon,authenticated;

create function public.add_project_task_batch(p_project_id uuid,p_tasks jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  project public.household_projects%rowtype;
  item jsonb;
  existing public.project_tasks%rowtype;
  selected_task_id uuid;
  receipt private.project_starter_selections%rowtype;
  payload jsonb;
  added integer:=0;
  skipped integer:=0;
  position integer;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into project from public.household_projects where id=p_project_id for update;
  if not found or not private.is_household_member(project.household_id) then
    raise exception 'project unavailable' using errcode='42501';
  end if;
  if project.archived_at is not null then raise exception 'Restore this plan before changing tasks.' using errcode='55000'; end if;
  if p_tasks is null or jsonb_typeof(p_tasks)<>'array' then raise exception 'invalid task batch' using errcode='22023'; end if;
  if jsonb_array_length(p_tasks) not between 1 and 20 then raise exception 'choose between one and twenty tasks' using errcode='22023'; end if;
  if (select count(distinct (value->>'id')::uuid) from jsonb_array_elements(p_tasks))<>jsonb_array_length(p_tasks) then
    raise exception 'duplicate task identity' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_tasks) loop
    if jsonb_typeof(item)<>'object' or item-array['id','title','section','notes']<>'{}'::jsonb
      or jsonb_typeof(item->'id') is distinct from 'string'
      or jsonb_typeof(item->'title') is distinct from 'string'
      or jsonb_typeof(item->'section') is distinct from 'string'
      or jsonb_typeof(item->'notes') is distinct from 'string'
      or length(trim(item->>'title')) not between 1 and 200
      or length(trim(item->>'section')) not between 1 and 80
      or length(item->>'notes')>4000 then
      raise exception 'invalid task details' using errcode='22023';
    end if;
    selected_task_id:=(item->>'id')::uuid;
    payload:=jsonb_build_object('title',trim(item->>'title'),'section',trim(item->>'section'),'notes',item->>'notes');
    select * into receipt from private.project_starter_selections where project_starter_selections.task_id=selected_task_id;
    if found then
      if receipt.household_id<>project.household_id or receipt.project_id<>project.id then
        raise exception 'task identity unavailable' using errcode='42501';
      end if;
      if receipt.payload<>payload then
        raise exception 'task identity already used for another selection' using errcode='22023';
      end if;
      skipped:=skipped+1;
      continue;
    end if;
    select * into existing from public.project_tasks where id=selected_task_id;
    if found then
      if existing.household_id<>project.household_id or existing.project_id<>project.id then
        raise exception 'task identity unavailable' using errcode='42501';
      end if;
      insert into private.project_starter_selections values(selected_task_id,project.household_id,project.id,payload);
      -- A replay never restores or overwrites a task changed after the first success.
      skipped:=skipped+1;
      continue;
    end if;
    if exists(select 1 from public.project_tasks where household_id=project.household_id
      and project_id=project.id and archived_at is null
      and title=trim(item->>'title') and section=trim(item->>'section')) then
      -- Remember skipped selections too: later edits must not resurrect them on retry.
      insert into private.project_starter_selections values(selected_task_id,project.household_id,project.id,payload);
      skipped:=skipped+1;
      continue;
    end if;
    select least(2147483647::bigint,coalesce(max(sort_order),0)::bigint+1)::integer into position
      from public.project_tasks where household_id=project.household_id and project_id=project.id;
    insert into public.project_tasks(id,household_id,created_by,project_id,title,section,notes,sort_order)
      values(selected_task_id,project.household_id,auth.uid(),project.id,trim(item->>'title'),trim(item->>'section'),item->>'notes',position);
    insert into private.project_starter_selections values(selected_task_id,project.household_id,project.id,payload);
    added:=added+1;
  end loop;
  return jsonb_build_object('added',added,'skipped',skipped);
end;
$$;
revoke all on function public.add_project_task_batch(uuid,jsonb) from public,anon;
grant execute on function public.add_project_task_batch(uuid,jsonb) to authenticated;
