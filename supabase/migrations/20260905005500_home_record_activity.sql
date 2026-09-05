-- The old validated checks allowed subsets of these values. New writes are
-- checked immediately; a later migration validates without an exclusive scan.
-- ADR0028 extends ADR0017's meaningful 90-day activity to saved Home records.
alter table public.activity_events
  drop constraint activity_events_kind_check;

alter table public.activity_events
  add constraint activity_events_kind_check check (
    kind in (
      'routine_created',
      'routine_updated',
      'occurrence_completed',
      'occurrence_skipped',
      'occurrence_rescheduled',
      'routine_paused',
      'routine_unpaused',
      'routine_archived',
      'meal_plan_entry_created',
      'meal_plan_entry_updated',
      'meal_plan_entry_removed',
      'shopping_session_finished',
      'opening_balance_established',
      'expense_posted',
      'expense_draft_confirmed',
      'expense_draft_dismissed',
      'refund_posted',
      'settlement_recorded',
      'financial_event_corrected',
      'recurring_expense_rule_created',
      'recurring_expense_rule_updated',
      'recurring_drafts_generated',
      'household_record_changed'
    )
  ) not valid;

alter table public.activity_events
  drop constraint activity_events_entity_type_check;

alter table public.activity_events
  add constraint activity_events_entity_type_check check (
    entity_type in (
      'routine',
      'routine_occurrence',
      'meal_plan_entry',
      'shopping_session',
      'financial_event',
      'expense_draft',
      'recurring_expense_rule',
      'expense_category',
      'household_record'
    )
  ) not valid;

create function private.record_household_record_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  current_record jsonb := to_jsonb(new);
  previous_record jsonb;
  operation text := 'added';
begin
  -- Trusted provisioning/maintenance with no end-user actor is not user activity.
  if actor is null then return new; end if;
  if not exists (
    select 1 from public.household_members
    where household_id = new.household_id and user_id = actor
  ) then
    raise exception 'Household membership required' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    previous_record := to_jsonb(old);
    -- Archive state matters; changing an already-set archive timestamp does not.
    if (current_record - array['updated_at', 'archived_at'])
      = (previous_record - array['updated_at', 'archived_at'])
      and (new.archived_at is null) = (old.archived_at is null) then
      return new;
    end if;
    operation := case
      when old.archived_at is null and new.archived_at is not null then 'archived'
      when old.archived_at is not null and new.archived_at is null then 'restored'
      else 'updated'
    end;
  end if;

  insert into public.activity_events (
    household_id, actor_member_id, kind, entity_type, entity_id, payload
  ) values (
    new.household_id, actor, 'household_record_changed', 'household_record', new.id,
    jsonb_build_object('record_kind', tg_argv[0], 'label', current_record ->> tg_argv[1],
      'operation', operation)
  );
  return new;
end;
$$;
revoke all on function private.record_household_record_activity() from public, anon, authenticated;

create trigger household_record_activity after insert or update on public.household_contacts
  for each row execute function private.record_household_record_activity('contact', 'name');
create trigger household_record_activity after insert or update on public.household_assets
  for each row execute function private.record_household_record_activity('asset', 'title');
create trigger household_record_activity after insert or update on public.household_commitments
  for each row execute function private.record_household_record_activity('commitment', 'title');
create trigger household_record_activity after insert or update on public.household_decisions
  for each row execute function private.record_household_record_activity('decision', 'title');
create trigger household_record_activity after insert or update on public.decision_options
  for each row execute function private.record_household_record_activity('decision_option', 'title');
create trigger household_record_activity after insert or update on public.household_documents
  for each row execute function private.record_household_record_activity('document', 'title');
create trigger household_record_activity after insert or update on public.asset_maintenance
  for each row execute function private.record_household_record_activity('maintenance', 'title');
