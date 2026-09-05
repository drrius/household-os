-- Extend the installed catalog so independently landed activity kinds survive.
do $$
declare expression text;
begin
 select pg_get_expr(conbin,conrelid) into expression from pg_constraint
 where conrelid='public.activity_events'::regclass and conname='activity_events_kind_check';
 if expression is null then raise exception 'Missing activity kind constraint'; end if;
 alter table public.activity_events drop constraint activity_events_kind_check;
 execute format('alter table public.activity_events add constraint activity_events_kind_check check ((%s) or kind in (''project_record_changed'',''project_task_assigned''))',expression);
 select pg_get_expr(conbin,conrelid) into expression from pg_constraint
 where conrelid='public.activity_events'::regclass and conname='activity_events_entity_type_check';
 if expression is null then raise exception 'Missing activity entity constraint'; end if;
 alter table public.activity_events drop constraint activity_events_entity_type_check;
 execute format('alter table public.activity_events add constraint activity_events_entity_type_check check ((%s) or entity_type in (''household_project'',''project_task''))',expression);
end;
$$;

create or replace function private.deliver_partner_notice(
  p_household_id uuid,
  p_actor_member_id uuid,
  p_activity_kind text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb,
  p_activity_event_id uuid,
  p_affect_member_ids uuid[] default array[]::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rule_outcome text;
  recipient uuid;
  other uuid;
begin
  if not private.member_belongs_to_household(
    p_household_id,
    p_actor_member_id
  ) then
    raise exception 'notification actor is not a member of household %',
      p_household_id
      using errcode = '42501';
  end if;

  rule_outcome := case p_activity_kind
    when 'project_record_changed' then 'activity_only'
    when 'project_task_assigned' then 'notify_affected_members'
    when 'occurrence_completed' then 'activity_only'
    when 'occurrence_skipped' then 'activity_only'
    when 'meal_plan_entry_created' then 'activity_only'
    when 'meal_plan_entry_updated' then 'activity_only'
    when 'meal_plan_entry_removed' then 'activity_only'
    when 'routine_created' then 'activity_only'
    when 'routine_paused' then 'activity_only'
    when 'routine_unpaused' then 'activity_only'
    when 'routine_archived' then 'activity_only'
    when 'expense_draft_dismissed' then 'activity_only'
    when 'recurring_expense_rule_created' then 'activity_only'
    when 'recurring_expense_rule_updated' then 'activity_only'
    when 'recurring_drafts_generated' then 'activity_only'
    when 'routine_updated' then 'notify_affected_members'
    when 'occurrence_rescheduled' then 'notify_affected_members'
    when 'shopping_session_finished' then 'notify_other_member'
    when 'opening_balance_established' then 'notify_other_member'
    when 'expense_posted' then 'notify_other_member'
    when 'expense_draft_confirmed' then 'notify_other_member'
    when 'refund_posted' then 'notify_other_member'
    when 'settlement_recorded' then 'notify_other_member'
    when 'financial_event_corrected' then 'notify_other_member'
    when 'direct_swap_completed' then 'notify_other_member'
    else null
  end;

  if rule_outcome is null then
    raise exception 'unknown activity kind for partner notify: %', p_activity_kind
      using errcode = '22023';
  end if;

  if rule_outcome = 'activity_only' then
    return;
  end if;

  if rule_outcome = 'notify_other_member' then
    other := private.other_household_member(p_household_id, p_actor_member_id);
    perform private.insert_partner_inbox_and_outbox(
      p_household_id,
      other,
      p_actor_member_id,
      p_activity_kind,
      p_entity_type,
      p_entity_id,
      p_payload,
      p_activity_event_id
    );
    return;
  end if;

  foreach recipient in array coalesce(p_affect_member_ids, array[]::uuid[])
  loop
    if recipient is distinct from p_actor_member_id then
      perform private.insert_partner_inbox_and_outbox(
        p_household_id,
        recipient,
        p_actor_member_id,
        p_activity_kind,
        p_entity_type,
        p_entity_id,
        p_payload,
        p_activity_event_id
      );
    end if;
  end loop;
end;
$$;

create function private.record_project_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 actor uuid := auth.uid();
 before_values jsonb := '{}'::jsonb;
 after_values jsonb;
 changed_fields text[];
 project_id uuid;
 project_title text;
 entity_kind text;
 event_kind text := 'project_record_changed';
 operation text := 'updated';
 event_id uuid;
 recipient uuid;
begin
 -- Trusted maintenance without a member has no human actor. Application writes
 -- still require membership through RLS; authenticated attribution is verified.
 if actor is null then return new; end if;
 if not private.is_household_member(new.household_id) then
  raise exception 'Caller cannot change this project' using errcode='42501';
 end if;
 if tg_op='UPDATE' then
  before_values := to_jsonb(old) - array['id','household_id','created_by','created_at','updated_at'];
 end if;
 after_values := to_jsonb(new) - array['id','household_id','created_by','created_at','updated_at'];
 select array_agg(key order by key) into changed_fields from jsonb_each(after_values)
 where value is distinct from before_values->key;
 if changed_fields is null then return new; end if;
 if tg_op='INSERT' then operation := 'created';
 elsif after_values->'archived_at' is distinct from before_values->'archived_at' then
  operation := case when new.archived_at is null then 'restored' else 'archived' end;
 elsif after_values->'completed_at' is distinct from before_values->'completed_at' then
  operation := case when after_values->>'completed_at' is null then 'reopened' else 'completed' end;
 end if;
 if tg_table_name='household_projects' then
  project_id := new.id;
  project_title := new.title;
  entity_kind := 'household_project';
 else
  project_id := new.project_id;
  select title into project_title from public.household_projects
   where id=project_id and household_id=new.household_id;
  entity_kind := 'project_task';
  if new.assigned_member_id is not null and new.assigned_member_id <> actor
   and new.archived_at is null and new.completed_at is null
   and (tg_op='INSERT' or after_values->'assigned_member_id' is distinct from before_values->'assigned_member_id') then
   recipient := new.assigned_member_id;
   event_kind := 'project_task_assigned';
  end if;
 end if;
 insert into public.activity_events(household_id,actor_member_id,kind,entity_type,entity_id,payload)
 values(new.household_id,actor,event_kind,entity_kind,new.id,jsonb_build_object(
  'project_id',project_id,'project_title',project_title,'title',new.title,'operation',operation,
  'before',before_values,'after',after_values,'changed_fields',changed_fields)) returning id into event_id;
 if recipient is not null then
  perform private.deliver_partner_notice(new.household_id,actor,event_kind,
   entity_kind,new.id,jsonb_build_object('project_id',project_id,'project_title',project_title,'title',new.title),event_id,array[recipient]);
 end if;
 return new;
end;
$$;
revoke all on function private.record_project_change() from public, anon, authenticated;
create trigger household_projects_activity after insert or update on public.household_projects
 for each row execute function private.record_project_change();
create trigger project_tasks_activity after insert or update on public.project_tasks
 for each row execute function private.record_project_change();
create index project_activity_history_idx on public.activity_events(household_id,(payload->>'project_id'),created_at desc,id desc)
 where kind in ('project_record_changed','project_task_assigned');
