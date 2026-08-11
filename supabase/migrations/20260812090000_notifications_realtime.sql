create table public.inbox_notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipient_member_id uuid not null,
  actor_member_id uuid,
  kind text not null
    check (kind in ('partner_notice', 'routine_reminder', 'household_digest')),
  activity_kind text,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  unique (household_id, recipient_member_id, dedupe_key),
  check (actor_member_id is null or recipient_member_id <> actor_member_id),
  foreign key (household_id, recipient_member_id)
    references public.household_members(household_id, user_id),
  foreign key (household_id, actor_member_id)
    references public.household_members(household_id, user_id)
);

create index inbox_notifications_recipient_created_idx
  on public.inbox_notifications (recipient_member_id, created_at desc);

create index inbox_notifications_household_created_idx
  on public.inbox_notifications (household_id, created_at desc);

create table public.notification_digest_preferences (
  household_id uuid not null,
  member_id uuid not null,
  enabled boolean not null default true,
  local_time time not null default '08:00',
  primary key (household_id, member_id),
  foreign key (household_id, member_id)
    references public.household_members(household_id, user_id) on delete cascade
);

create table public.push_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null,
  member_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  unique (endpoint),
  unique (household_id, id),
  foreign key (household_id, member_id)
    references public.household_members(household_id, user_id) on delete cascade
);

create table public.push_outbox (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipient_member_id uuid not null,
  inbox_notification_id uuid not null,
  status text not null default 'pending'
    check (
      status in ('pending', 'sent', 'skipped_no_subscription', 'failed')
    ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (inbox_notification_id),
  foreign key (household_id, recipient_member_id)
    references public.household_members(household_id, user_id),
  foreign key (household_id, inbox_notification_id)
    references public.inbox_notifications(household_id, id) on delete cascade
);

create table public.job_claims (
  schedule_key text primary key
    check (length(trim(schedule_key)) between 1 and 300),
  job_kind text not null
    check (
      job_kind in (
        'deliver_due_reminders',
        'deliver_member_digests',
        'ensure_due_occurrences',
        'generate_recurring_drafts_cron',
        'retain_activity_events',
        'retain_purchased_groceries',
        'drain_push_outbox'
      )
    ),
  status text not null check (status in ('started', 'succeeded', 'failed')),
  attempt_count integer not null default 1 check (attempt_count >= 1),
  result jsonb,
  last_error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  check (
    (status = 'started' and finished_at is null)
    or status <> 'started'
  )
);

create or replace function private.member_belongs_to_household(
  p_household_id uuid,
  p_member_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as member
    where member.household_id = p_household_id
      and member.user_id = p_member_id
  );
$$;

create or replace function private.affected_members_for_routine_change(
  p_old_assigned_member_id uuid,
  p_old_assignment_policy text,
  p_new_assigned_member_id uuid,
  p_new_assignment_policy text,
  p_household_id uuid
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  affected_member_ids uuid[];
begin
  if p_old_assignment_policy in ('alternating', 'shared')
    or p_new_assignment_policy in ('alternating', 'shared')
  then
    select coalesce(
      array_agg(member.user_id order by member.user_id),
      '{}'::uuid[]
    )
    into affected_member_ids
    from public.household_members as member
    where member.household_id = p_household_id;
    return affected_member_ids;
  end if;

  select coalesce(array_agg(member_id order by member_id), '{}'::uuid[])
  into affected_member_ids
  from (
    select distinct candidate.member_id
    from unnest(
      array[p_old_assigned_member_id, p_new_assigned_member_id]
    ) as candidate(member_id)
    join public.household_members as member
      on member.household_id = p_household_id
      and member.user_id = candidate.member_id
    where candidate.member_id is not null
  ) as affected;

  return affected_member_ids;
end;
$$;

create or replace function private.insert_partner_inbox_and_outbox(
  p_household_id uuid,
  p_recipient_member_id uuid,
  p_actor_member_id uuid,
  p_activity_kind text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inbox_id uuid;
  dedupe text;
  has_subscription boolean;
  outbox_status text;
begin
  if p_recipient_member_id = p_actor_member_id then
    return;
  end if;
  if not private.member_belongs_to_household(p_household_id, p_recipient_member_id) then
    return;
  end if;

  dedupe := 'partner:' || p_activity_kind || ':' || p_entity_id::text;

  insert into public.inbox_notifications (
    household_id,
    recipient_member_id,
    actor_member_id,
    kind,
    activity_kind,
    entity_type,
    entity_id,
    payload,
    dedupe_key
  )
  values (
    p_household_id,
    p_recipient_member_id,
    p_actor_member_id,
    'partner_notice',
    p_activity_kind,
    p_entity_type,
    p_entity_id,
    coalesce(p_payload, '{}'::jsonb),
    dedupe
  )
  on conflict (household_id, recipient_member_id, dedupe_key) do nothing
  returning id into inbox_id;

  if inbox_id is null then
    return;
  end if;

  select exists (
    select 1
    from public.push_subscriptions as subscription
    where subscription.household_id = p_household_id
      and subscription.member_id = p_recipient_member_id
      and subscription.disabled_at is null
  )
  into has_subscription;

  outbox_status := case
    when has_subscription then 'pending'
    else 'skipped_no_subscription'
  end;

  insert into public.push_outbox (
    household_id,
    recipient_member_id,
    inbox_notification_id,
    status,
    processed_at
  )
  values (
    p_household_id,
    p_recipient_member_id,
    inbox_id,
    outbox_status,
    case when outbox_status = 'skipped_no_subscription' then now() else null end
  );
end;
$$;

create or replace function private.deliver_partner_notice(
  p_household_id uuid,
  p_actor_member_id uuid,
  p_activity_kind text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb,
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
      p_payload
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
        p_payload
      );
    end if;
  end loop;
end;
$$;

create or replace function private.cancel_inbox_reminder_for_occurrence(
  p_occurrence_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.inbox_notifications as inbox
  where inbox.kind = 'routine_reminder'
    and inbox.dedupe_key = 'reminder:' || p_occurrence_id::text
    and inbox.read_at is null;
end;
$$;

create or replace function private.claim_job(
  p_schedule_key text,
  p_job_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim public.job_claims%rowtype;
begin
  if p_schedule_key is null
    or length(trim(p_schedule_key)) not between 1 and 300
  then
    raise exception 'schedule key must contain 1 to 300 characters'
      using errcode = '22023';
  end if;
  if p_job_kind not in (
    'deliver_due_reminders',
    'deliver_member_digests',
    'ensure_due_occurrences',
    'generate_recurring_drafts_cron',
    'retain_activity_events',
    'retain_purchased_groceries',
    'drain_push_outbox'
  ) then
    raise exception 'unknown job kind %', p_job_kind
      using errcode = '22023';
  end if;
  if p_schedule_key not like p_job_kind || ':%' then
    raise exception 'schedule key does not match job kind %', p_job_kind
      using errcode = '22023';
  end if;

  insert into public.job_claims (schedule_key, job_kind, status)
  values (p_schedule_key, p_job_kind, 'started')
  on conflict (schedule_key) do nothing
  returning * into claim;

  if found then
    return jsonb_build_object('decision', 'run', 'claim', to_jsonb(claim));
  end if;

  select stored_claim.*
  into claim
  from public.job_claims as stored_claim
  where stored_claim.schedule_key = p_schedule_key
  for update;

  if claim.job_kind <> p_job_kind then
    raise exception 'schedule key was already used for a different job'
      using errcode = '22023';
  end if;

  case claim.status
    when 'succeeded' then
      return jsonb_build_object(
        'decision', 'already_succeeded',
        'claim', to_jsonb(claim)
      );
    when 'started' then
      return jsonb_build_object(
        'decision', 'in_progress',
        'claim', to_jsonb(claim)
      );
    when 'failed' then
      update public.job_claims
      set status = 'started',
          attempt_count = attempt_count + 1,
          result = null,
          last_error = null,
          finished_at = null,
          started_at = now()
      where schedule_key = p_schedule_key
      returning * into claim;
      return jsonb_build_object(
        'decision', 'retry_failed',
        'claim', to_jsonb(claim)
      );
    else
      raise exception 'unknown job claim status %', claim.status
        using errcode = '23514';
  end case;
end;
$$;

create or replace function private.complete_job_claim(
  p_schedule_key text,
  p_result jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.job_claims
  set status = 'succeeded',
      result = coalesce(p_result, '{}'::jsonb),
      finished_at = now(),
      last_error = null
  where schedule_key = p_schedule_key
    and status = 'started';
  if not found then
    raise exception 'job claim % is not started', p_schedule_key
      using errcode = '55000';
  end if;
end;
$$;

create or replace function private.fail_job_claim(
  p_schedule_key text,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.job_claims
  set status = 'failed',
      result = null,
      last_error = left(coalesce(p_error, 'unknown job failure'), 4000),
      finished_at = now()
  where schedule_key = p_schedule_key
    and status = 'started';
  if not found then
    raise exception 'job claim % is not started', p_schedule_key
      using errcode = '55000';
  end if;
end;
$$;

create or replace function private.post_financial_event(
  p_household_id uuid,
  p_actor_member_id uuid,
  p_type text,
  p_payer_member_id uuid,
  p_description text,
  p_amount_cents bigint,
  p_allocations jsonb,
  p_occurred_on date,
  p_related_event_id uuid,
  p_category_id uuid,
  p_note text,
  p_receipt_path text,
  p_shopping_session_id uuid,
  p_expense_draft_id uuid,
  p_activity_kind text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
  other_member_id uuid;
  payer_allocation bigint;
  other_allocation bigint;
  activity_payload jsonb;
begin
  if p_amount_cents is null
    or p_amount_cents not between 0 and 9007199254740991
  then
    raise exception 'amount_cents must be non-negative safe integer centimes'
      using errcode = '22023';
  end if;
  if p_occurred_on is null then
    raise exception 'occurred_on is required' using errcode = '22023';
  end if;
  if p_description is null
    or length(trim(p_description)) not between 1 and 200
  then
    raise exception 'description must contain 1 to 200 characters'
      using errcode = '22023';
  end if;

  if p_type = 'reversal' then
    if p_payer_member_id is not null or p_related_event_id is null then
      raise exception 'reversal requires only a related event'
        using errcode = '22023';
    end if;
  else
    other_member_id := private.other_household_member(
      p_household_id,
      p_payer_member_id
    );
  end if;

  if p_type in ('expense', 'refund', 'replacement') then
    perform private.validate_money_allocations(
      p_household_id,
      p_amount_cents,
      p_allocations
    );
  elsif p_allocations is not null then
    raise exception '% does not accept allocations', p_type
      using errcode = '22023';
  end if;

  insert into public.financial_events (
    household_id,
    type,
    occurred_on,
    created_by_member_id,
    payer_member_id,
    description,
    amount_cents,
    related_event_id,
    category_id,
    note,
    receipt_path,
    shopping_session_id,
    expense_draft_id
  )
  values (
    p_household_id,
    p_type,
    p_occurred_on,
    p_actor_member_id,
    p_payer_member_id,
    trim(p_description),
    p_amount_cents,
    p_related_event_id,
    p_category_id,
    p_note,
    p_receipt_path,
    p_shopping_session_id,
    p_expense_draft_id
  )
  returning id into event_id;

  if p_type in ('expense', 'refund', 'replacement') then
    insert into public.financial_allocations (
      household_id,
      financial_event_id,
      member_id,
      allocated_cents
    )
    select
      p_household_id,
      event_id,
      item."memberId",
      item."allocatedCents"
    from jsonb_to_recordset(p_allocations)
      as item("memberId" uuid, "allocatedCents" bigint);

    select allocation.allocated_cents
    into payer_allocation
    from public.financial_allocations as allocation
    where allocation.financial_event_id = event_id
      and allocation.member_id = p_payer_member_id;

    select allocation.allocated_cents
    into other_allocation
    from public.financial_allocations as allocation
    where allocation.financial_event_id = event_id
      and allocation.member_id = other_member_id;

    insert into public.ledger_entries (
      household_id,
      financial_event_id,
      member_id,
      receivable_delta_cents
    )
    values
      (
        p_household_id,
        event_id,
        p_payer_member_id,
        case
          when p_type = 'refund'
            then -(p_amount_cents - payer_allocation)
          else p_amount_cents - payer_allocation
        end
      ),
      (
        p_household_id,
        event_id,
        other_member_id,
        case
          when p_type = 'refund' then other_allocation
          else -other_allocation
        end
      );
  elsif p_type in ('opening_balance', 'settlement') then
    insert into public.ledger_entries (
      household_id,
      financial_event_id,
      member_id,
      receivable_delta_cents
    )
    values
      (p_household_id, event_id, p_payer_member_id, p_amount_cents),
      (p_household_id, event_id, other_member_id, -p_amount_cents);
  elsif p_type = 'reversal' then
    insert into public.ledger_entries (
      household_id,
      financial_event_id,
      member_id,
      receivable_delta_cents
    )
    select
      p_household_id,
      event_id,
      entry.member_id,
      -entry.receivable_delta_cents
    from public.ledger_entries as entry
    where entry.household_id = p_household_id
      and entry.financial_event_id = p_related_event_id;

    if (select count(*) from public.ledger_entries where financial_event_id = event_id) <> 2
    then
      raise exception 'related event does not have a complete ledger projection'
        using errcode = '23514';
    end if;
  else
    raise exception 'unknown financial event type %', p_type
      using errcode = '22023';
  end if;

  if p_activity_kind is not null then
    activity_payload := jsonb_build_object('financial_event_type', p_type);
    insert into public.activity_events (
      household_id,
      actor_member_id,
      kind,
      entity_type,
      entity_id,
      payload
    )
    values (
      p_household_id,
      p_actor_member_id,
      p_activity_kind,
      'financial_event',
      event_id,
      activity_payload
    );
    perform private.deliver_partner_notice(
      p_household_id,
      p_actor_member_id,
      p_activity_kind,
      'financial_event',
      event_id,
      activity_payload
    );
  end if;
  return event_id;
end;
$$;

create or replace function public.confirm_expense_draft(
  p_draft_id uuid,
  p_idempotency_key text,
  p_amount_cents bigint default null,
  p_payer_member_id uuid default null,
  p_allocations jsonb default null,
  p_occurred_on date default null,
  p_category_id uuid default null,
  p_note text default null,
  p_receipt_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid;
  draft public.expense_drafts%rowtype;
  request_payload jsonb;
  prior_result jsonb;
  result jsonb;
  event_id uuid;
  activity_payload jsonb;
begin
  select stored_draft.*
  into draft
  from public.expense_drafts as stored_draft
  where stored_draft.id = p_draft_id;
  if not found then
    raise exception 'expense draft % does not exist', p_draft_id
      using errcode = 'P0002';
  end if;
  actor_member_id := private.require_money_actor(draft.household_id);
  request_payload := jsonb_build_object(
    'draft_id', p_draft_id,
    'amount_cents', p_amount_cents,
    'payer_member_id', p_payer_member_id,
    'allocations', p_allocations,
    'occurred_on', p_occurred_on,
    'category_id', p_category_id,
    'note', p_note,
    'receipt_path', p_receipt_path
  );
  prior_result := private.get_money_command_result(
    draft.household_id, p_idempotency_key, 'confirm_expense_draft',
    request_payload
  );
  if prior_result is not null then
    return prior_result;
  end if;

  select stored_draft.*
  into draft
  from public.expense_drafts as stored_draft
  where stored_draft.id = p_draft_id
  for update;
  if draft.status <> 'pending' then
    raise exception 'only pending expense drafts can be confirmed'
      using errcode = '55000';
  end if;

  event_id := private.post_financial_event(
    draft.household_id, actor_member_id, 'expense',
    coalesce(p_payer_member_id, draft.payer_member_id),
    draft.description, coalesce(p_amount_cents, draft.amount_cents),
    coalesce(p_allocations, draft.proposed_allocations),
    coalesce(p_occurred_on, draft.occurred_on), null,
    coalesce(p_category_id, draft.category_id),
    p_note, p_receipt_path, draft.shopping_session_id, draft.id, null
  );
  update public.expense_drafts
  set status = 'posted'
  where id = draft.id;

  activity_payload := jsonb_build_object('financial_event_id', event_id);
  insert into public.activity_events (
    household_id, actor_member_id, kind, entity_type, entity_id, payload
  )
  values (
    draft.household_id, actor_member_id, 'expense_draft_confirmed',
    'expense_draft', draft.id, activity_payload
  );
  perform private.deliver_partner_notice(
    draft.household_id,
    actor_member_id,
    'expense_draft_confirmed',
    'expense_draft',
    draft.id,
    activity_payload
  );
  result := jsonb_build_object(
    'expense_draft_id', draft.id,
    'financial_event_id', event_id
  );
  perform private.store_money_command_result(
    draft.household_id, p_idempotency_key, 'confirm_expense_draft',
    request_payload, result
  );
  return result;
end;
$$;

create or replace function public.correct_financial_event(
  p_event_id uuid,
  p_idempotency_key text,
  p_replacement jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid;
  target public.financial_events%rowtype;
  request_payload jsonb;
  prior_result jsonb;
  result jsonb;
  reversal_event_id uuid;
  replacement_event_id uuid;
  activity_payload jsonb;
begin
  select stored_event.*
  into target
  from public.financial_events as stored_event
  where stored_event.id = p_event_id;
  if not found then
    raise exception 'financial event % does not exist', p_event_id
      using errcode = 'P0002';
  end if;
  actor_member_id := private.require_money_actor(target.household_id);
  request_payload := jsonb_build_object(
    'event_id', p_event_id,
    'replacement', p_replacement
  );
  prior_result := private.get_money_command_result(
    target.household_id, p_idempotency_key, 'correct_financial_event',
    request_payload
  );
  if prior_result is not null then
    return prior_result;
  end if;

  select stored_event.*
  into target
  from public.financial_events as stored_event
  where stored_event.id = p_event_id
  for update;
  if target.type = 'reversal' then
    raise exception 'reversal events cannot be corrected'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.financial_events as child
    where child.related_event_id = target.id
      and child.type = 'reversal'
  ) then
    raise exception 'financial event has already been corrected'
      using errcode = '55000';
  end if;
  if p_replacement is not null
    and jsonb_typeof(p_replacement) <> 'object'
  then
    raise exception 'replacement must be a JSON object'
      using errcode = '22023';
  end if;
  if p_replacement is not null
    and target.type not in ('expense', 'replacement')
  then
    raise exception
      'replacement corrections are only supported for expense events'
      using errcode = '22023';
  end if;

  reversal_event_id := private.post_financial_event(
    target.household_id, actor_member_id, 'reversal', null,
    'Reversal: ' || target.description, target.amount_cents, null,
    target.occurred_on, target.id, null, null, null, null, null, null
  );

  if p_replacement is not null then
    replacement_event_id := private.post_financial_event(
      target.household_id, actor_member_id, 'replacement',
      (p_replacement ->> 'payer_member_id')::uuid,
      p_replacement ->> 'description',
      (p_replacement ->> 'amount_cents')::bigint,
      p_replacement -> 'allocations',
      (p_replacement ->> 'occurred_on')::date,
      target.id,
      (p_replacement ->> 'category_id')::uuid,
      p_replacement ->> 'note',
      p_replacement ->> 'receipt_path',
      null, null, null
    );
  end if;

  activity_payload := jsonb_strip_nulls(
    jsonb_build_object(
      'reversal_event_id', reversal_event_id,
      'replacement_event_id', replacement_event_id
    )
  );
  insert into public.activity_events (
    household_id, actor_member_id, kind, entity_type, entity_id, payload
  )
  values (
    target.household_id, actor_member_id, 'financial_event_corrected',
    'financial_event', target.id, activity_payload
  );
  perform private.deliver_partner_notice(
    target.household_id,
    actor_member_id,
    'financial_event_corrected',
    'financial_event',
    target.id,
    activity_payload
  );
  result := jsonb_strip_nulls(
    jsonb_build_object(
      'corrected_financial_event_id', target.id,
      'reversal_event_id', reversal_event_id,
      'replacement_event_id', replacement_event_id
    )
  );
  perform private.store_money_command_result(
    target.household_id, p_idempotency_key, 'correct_financial_event',
    request_payload, result
  );
  return result;
end;
$$;

create or replace function public.finish_shopping_session(
  p_shopping_session_id uuid,
  p_idempotency_key text,
  p_occurred_on date,
  p_receipt_total_cents bigint default null,
  p_receipt_path text default null,
  p_create_expense_draft boolean default false,
  p_expense_description text default null,
  p_shared_amount_cents bigint default null,
  p_payer_member_id uuid default null,
  p_proposed_allocations jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  session public.shopping_sessions%rowtype;
  request_payload jsonb;
  prior_result jsonb;
  result jsonb;
  finished_timestamp timestamptz := now();
  draft_id uuid;
  purchased_count integer;
  expense_description text;
  activity_payload jsonb;
begin
  select stored_session.*
  into session
  from public.shopping_sessions as stored_session
  where stored_session.id = p_shopping_session_id;

  if not found then
    raise exception 'shopping session % does not exist', p_shopping_session_id
      using errcode = 'P0002';
  end if;
  if actor_member_id is null
    or session.member_id <> actor_member_id
    or not private.is_household_member(session.household_id)
  then
    raise exception 'caller cannot finish shopping session %', session.id
      using errcode = '42501';
  end if;
  if p_receipt_total_cents is not null
    and p_receipt_total_cents not between 0 and 9007199254740991
  then
    raise exception 'receipt total must be non-negative safe integer centimes'
      using errcode = '22023';
  end if;
  if p_shared_amount_cents is not null
    and p_shared_amount_cents not between 0 and 9007199254740991
  then
    raise exception 'shared amount must be non-negative safe integer centimes'
      using errcode = '22023';
  end if;

  request_payload := jsonb_build_object(
    'shopping_session_id', p_shopping_session_id,
    'occurred_on', p_occurred_on,
    'receipt_total_cents', p_receipt_total_cents,
    'receipt_path', p_receipt_path,
    'create_expense_draft', p_create_expense_draft,
    'expense_description', p_expense_description,
    'shared_amount_cents', p_shared_amount_cents,
    'payer_member_id', p_payer_member_id,
    'proposed_allocations', p_proposed_allocations
  );
  prior_result := private.get_meal_grocery_command_result(
    session.household_id,
    p_idempotency_key,
    'finish_shopping_session',
    request_payload
  );
  if prior_result is not null then
    return prior_result;
  end if;

  select stored_session.*
  into session
  from public.shopping_sessions as stored_session
  where stored_session.id = p_shopping_session_id
  for update;

  if session.finished_at is not null then
    raise exception 'shopping session has already finished'
      using errcode = '55000';
  end if;

  select count(*)::integer
  into purchased_count
  from public.grocery_items as item
  where item.household_id = session.household_id
    and item.state = 'claimed'
    and item.claimed_by_session_id = session.id;

  if purchased_count = 0 then
    raise exception 'finish shopping requires at least one claimed item'
      using errcode = '55000';
  end if;

  if p_create_expense_draft then
    if p_occurred_on is null
      or p_shared_amount_cents is null
      or p_payer_member_id is null
    then
      raise exception 'expense draft requires date, shared amount, and payer'
        using errcode = '22023';
    end if;
    if p_proposed_allocations is null
      or jsonb_typeof(p_proposed_allocations) <> 'array'
    then
      raise exception 'proposed allocations must be a JSON array'
        using errcode = '22023';
    end if;
    if not exists (
      select 1
      from public.household_members as member
      where member.household_id = session.household_id
        and member.user_id = p_payer_member_id
    ) then
      raise exception 'payer does not belong to the shopping household'
        using errcode = '42501';
    end if;

    expense_description := coalesce(
      nullif(trim(p_expense_description), ''),
      'Groceries'
    );

    insert into public.expense_drafts (
      household_id,
      source_kind,
      shopping_session_id,
      description,
      amount_cents,
      payer_member_id,
      proposed_allocations,
      occurred_on
    )
    values (
      session.household_id,
      'shopping',
      session.id,
      expense_description,
      p_shared_amount_cents,
      p_payer_member_id,
      p_proposed_allocations,
      p_occurred_on
    )
    returning id into draft_id;
  end if;

  update public.grocery_items
  set state = 'purchased',
      claimed_by_session_id = null,
      purchased_at = finished_timestamp
  where household_id = session.household_id
    and state = 'claimed'
    and claimed_by_session_id = session.id;

  update public.shopping_session_items
  set purchased_at = finished_timestamp
  where shopping_session_id = session.id
    and purchased_at is null;

  update public.shopping_sessions
  set finished_at = finished_timestamp,
      receipt_total_cents = p_receipt_total_cents,
      receipt_path = p_receipt_path,
      draft_expense_id = draft_id
  where id = session.id;

  activity_payload := jsonb_build_object(
    'purchased_item_count', purchased_count,
    'expense_draft_id', draft_id
  );
  insert into public.activity_events (
    household_id,
    actor_member_id,
    kind,
    entity_type,
    entity_id,
    payload
  )
  values (
    session.household_id,
    actor_member_id,
    'shopping_session_finished',
    'shopping_session',
    session.id,
    activity_payload
  );
  perform private.deliver_partner_notice(
    session.household_id,
    actor_member_id,
    'shopping_session_finished',
    'shopping_session',
    session.id,
    activity_payload
  );

  result := jsonb_strip_nulls(
    jsonb_build_object(
      'shopping_session_id', session.id,
      'purchased_item_count', purchased_count,
      'expense_draft_id', draft_id
    )
  );

  insert into public.meal_grocery_command_receipts (
    household_id,
    idempotency_key,
    command_kind,
    request_payload,
    result
  )
  values (
    session.household_id,
    p_idempotency_key,
    'finish_shopping_session',
    request_payload,
    result
  );

  return result;
end;
$$;

create or replace function public.update_routine_definition(
  p_routine_id uuid,
  p_title text default null,
  p_instructions text default null,
  p_area_id uuid default null,
  p_pet_id uuid default null,
  p_assignment_policy text default null,
  p_assigned_member_id uuid default null,
  p_rotation_anchor_member_id uuid default null,
  p_schedule_kind text default null,
  p_schedule_rule jsonb default null,
  p_priority text default null,
  p_active_from date default null,
  p_active_until date default null,
  p_rebuild_window boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  routine public.routines%rowtype;
  previous_routine public.routines%rowtype;
  next_schedule_kind text;
  next_schedule_rule jsonb;
  next_assignment_policy text;
  next_assigned uuid;
  next_rotation uuid;
  open_row public.routine_occurrences%rowtype;
  first_due date;
  affect_member_ids uuid[] := array[]::uuid[];
  schedule_or_assignment_changed boolean := false;
  activity_payload jsonb;
begin
  select * into routine from public.routines where id = p_routine_id for update;
  previous_routine := routine;
  if routine.id is null then
    raise exception 'routine % does not exist', p_routine_id using errcode = 'P0002';
  end if;
  if actor_member_id is null or not private.is_household_member(routine.household_id) then
    raise exception 'caller is not a member of household %', routine.household_id
      using errcode = '42501';
  end if;
  if routine.archived_at is not null then
    raise exception 'archived routines cannot be edited' using errcode = '55000';
  end if;

  next_schedule_kind := coalesce(p_schedule_kind, routine.schedule_kind);
  next_schedule_rule := coalesce(p_schedule_rule, routine.schedule_rule);
  if not private.is_valid_routine_schedule(next_schedule_kind, next_schedule_rule) then
    raise exception 'invalid schedule rule for schedule kind %', next_schedule_kind
      using errcode = '22023';
  end if;

  next_assignment_policy := coalesce(p_assignment_policy, routine.assignment_policy);
  if p_assignment_policy is null then
    next_assigned := coalesce(p_assigned_member_id, routine.assigned_member_id);
    next_rotation := coalesce(p_rotation_anchor_member_id, routine.rotation_anchor_member_id);
  else
    next_assigned := p_assigned_member_id;
    next_rotation := p_rotation_anchor_member_id;
  end if;

  case next_assignment_policy
    when 'assigned' then
      if next_assigned is null or next_rotation is not null then
        raise exception 'assigned routines require only assigned_member_id'
          using errcode = '22023';
      end if;
    when 'alternating' then
      if next_assigned is not null or next_rotation is null then
        raise exception 'alternating routines require only rotation_anchor_member_id'
          using errcode = '22023';
      end if;
    when 'shared' then
      if next_assigned is not null or next_rotation is not null then
        raise exception 'shared routines cannot name an assignee'
          using errcode = '22023';
      end if;
    else
      raise exception 'unknown assignment policy %', next_assignment_policy
        using errcode = '22023';
  end case;

  update public.routines
  set
    title = coalesce(nullif(trim(p_title), ''), title),
    instructions = case when p_instructions is null then instructions else p_instructions end,
    area_id = coalesce(p_area_id, area_id),
    pet_id = case when p_pet_id is null and p_area_id is null then pet_id else p_pet_id end,
    assignment_policy = next_assignment_policy,
    assigned_member_id = next_assigned,
    rotation_anchor_member_id = next_rotation,
    schedule_kind = next_schedule_kind,
    schedule_rule = next_schedule_rule,
    priority = coalesce(p_priority, priority),
    active_from = case when p_active_from is null and p_active_until is null then active_from else p_active_from end,
    active_until = case when p_active_from is null and p_active_until is null then active_until else p_active_until end,
    updated_at = now()
  where id = p_routine_id
  returning * into routine;

  if p_rebuild_window
    and (
      p_schedule_kind is not null
      or p_schedule_rule is not null
      or p_assignment_policy is not null
      or p_assigned_member_id is not null
      or p_rotation_anchor_member_id is not null
      or p_active_from is not null
      or p_active_until is not null
    )
  then
    for open_row in
      select *
      from public.routine_occurrences
      where routine_id = p_routine_id
        and status = 'open'
      for update
    loop
      update public.reminder_candidates
      set status = 'cancelled'
      where occurrence_id = open_row.id
        and status = 'pending';
      delete from public.routine_occurrences where id = open_row.id;
    end loop;

    first_due := private.first_routine_due_date(
      routine.schedule_rule,
      greatest(private.household_today(), coalesce(routine.active_from, private.household_today()))
    );
    perform private.ensure_routine_window(routine.id, first_due, null);
  end if;

  schedule_or_assignment_changed :=
    previous_routine.schedule_kind is distinct from routine.schedule_kind
    or previous_routine.schedule_rule is distinct from routine.schedule_rule
    or previous_routine.assignment_policy is distinct from routine.assignment_policy
    or previous_routine.assigned_member_id is distinct from routine.assigned_member_id
    or previous_routine.rotation_anchor_member_id is distinct from routine.rotation_anchor_member_id
    or previous_routine.active_from is distinct from routine.active_from
    or previous_routine.active_until is distinct from routine.active_until;

  if schedule_or_assignment_changed then
    affect_member_ids := private.affected_members_for_routine_change(
      previous_routine.assigned_member_id,
      previous_routine.assignment_policy,
      routine.assigned_member_id,
      routine.assignment_policy,
      routine.household_id
    );
  end if;

  activity_payload := jsonb_build_object(
    'schedule_kind', routine.schedule_kind,
    'assignment_policy', routine.assignment_policy,
    'affect_member_ids', to_jsonb(affect_member_ids)
  );
  insert into public.activity_events (
    household_id,
    actor_member_id,
    kind,
    entity_type,
    entity_id,
    payload
  )
  values (
    routine.household_id,
    actor_member_id,
    'routine_updated',
    'routine',
    routine.id,
    activity_payload
  );

  if schedule_or_assignment_changed then
    perform private.deliver_partner_notice(
      routine.household_id,
      actor_member_id,
      'routine_updated',
      'routine',
      routine.id,
      activity_payload,
      affect_member_ids
    );
  end if;

  return jsonb_build_object('routine_id', routine.id);
end;
$$;

create or replace function private.apply_routine_closure(
  p_occurrence_id uuid,
  p_idempotency_key text,
  p_command_kind text,
  p_completed_on date default null,
  p_new_due_date date default null,
  p_note text default null,
  p_photo_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  target_household_id uuid;
  occurrence public.routine_occurrences%rowtype;
  preview public.routine_occurrences%rowtype;
  routine public.routines%rowtype;
  prior_result jsonb;
  result jsonb;
  routine_active boolean;
  had_preview boolean := false;
  first_due_date date;
  second_due_date date;
  current_occurrence_id uuid;
  preview_occurrence_id uuid;
  new_current public.routine_occurrences%rowtype;
  activity_payload jsonb;
begin
  if p_idempotency_key is null
    or length(trim(p_idempotency_key)) not between 1 and 200
  then
    raise exception 'idempotency key must contain 1 to 200 characters'
      using errcode = '22023';
  end if;

  if p_command_kind not in ('complete', 'skip', 'reschedule') then
    raise exception 'unknown routine command kind %', p_command_kind
      using errcode = '22023';
  end if;

  select stored_occurrence.household_id
  into target_household_id
  from public.routine_occurrences as stored_occurrence
  where stored_occurrence.id = p_occurrence_id;

  if not found then
    raise exception 'routine occurrence % does not exist', p_occurrence_id
      using errcode = 'P0002';
  end if;

  if actor_member_id is null
    or not private.is_household_member(target_household_id)
  then
    raise exception 'caller is not a member of household %', target_household_id
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_household_id::text || ':' || p_idempotency_key, 0)
  );

  select receipt.result
  into prior_result
  from public.routine_command_receipts as receipt
  where receipt.household_id = target_household_id
    and receipt.idempotency_key = p_idempotency_key;
  if found then
    return prior_result;
  end if;

  select stored_occurrence.*
  into occurrence
  from public.routine_occurrences as stored_occurrence
  where stored_occurrence.id = p_occurrence_id
  for update;

  select stored_routine.*
  into routine
  from public.routines as stored_routine
  where stored_routine.id = occurrence.routine_id
  for update;

  if occurrence.status <> 'open' then
    raise exception 'routine occurrence % is not open', occurrence.id
      using errcode = '55000';
  end if;
  if occurrence.role <> 'current' then
    raise exception 'only the current occurrence can be changed'
      using errcode = '55000';
  end if;

  select stored_preview.*
  into preview
  from public.routine_occurrences as stored_preview
  where stored_preview.routine_id = routine.id
    and stored_preview.status = 'open'
    and stored_preview.role = 'preview'
  for update;
  had_preview := found;

  routine_active := routine.archived_at is null
    and routine.paused_at is null
    and (
      routine.active_from is null
      or occurrence.due_date >= routine.active_from
    )
    and (
      routine.active_until is null
      or occurrence.due_date <= routine.active_until
    );

  if p_command_kind = 'reschedule' then
    if p_new_due_date is null or p_new_due_date = occurrence.due_date then
      raise exception 'reschedule date must differ from the current due date'
        using errcode = '22023';
    end if;

    update public.routine_occurrences
    set due_date = p_new_due_date,
        rescheduled_at = now()
    where id = occurrence.id;

    update public.reminder_candidates
    set status = 'cancelled'
    where occurrence_id = occurrence.id
      and status = 'pending';
    perform private.create_reminder_candidates_for_occurrence(occurrence.id);

    activity_payload := jsonb_build_object(
      'routine_id', routine.id,
      'from_due_date', occurrence.due_date,
      'to_due_date', p_new_due_date
    );
    insert into public.activity_events (
      household_id,
      actor_member_id,
      kind,
      entity_type,
      entity_id,
      payload
    )
    values (
      routine.household_id,
      actor_member_id,
      'occurrence_rescheduled',
      'routine_occurrence',
      occurrence.id,
      activity_payload
    );
    perform private.deliver_partner_notice(
      routine.household_id,
      actor_member_id,
      'occurrence_rescheduled',
      'routine_occurrence',
      occurrence.id,
      activity_payload,
      array_remove(array[occurrence.planned_assignee_id], null)
    );
  else
    if p_command_kind = 'complete' and p_completed_on is null then
      raise exception 'completed_on is required for completion'
        using errcode = '22023';
    end if;

    update public.routine_occurrences
    set status = case
          when p_command_kind = 'complete' then 'completed'
          else 'skipped'
        end,
        role = null,
        closed_at = now()
    where id = occurrence.id;

    if p_command_kind = 'complete' then
      insert into public.routine_completions (
        occurrence_id,
        household_id,
        completed_by_member_id,
        completed_on,
        note,
        photo_path
      )
      values (
        occurrence.id,
        routine.household_id,
        actor_member_id,
        p_completed_on,
        p_note,
        p_photo_path
      );
    end if;

    update public.reminder_candidates
    set status = 'cancelled'
    where occurrence_id = occurrence.id
      and status = 'pending';

    perform private.cancel_inbox_reminder_for_occurrence(occurrence.id);

    if routine_active then
      first_due_date := private.next_routine_due_date(
        routine.schedule_rule,
        occurrence.due_date,
        case when p_command_kind = 'complete' then p_completed_on else null end
      );
    end if;

    if not routine_active
      or first_due_date is null
      or (routine.active_until is not null and first_due_date > routine.active_until)
    then
      if had_preview then
        delete from public.routine_occurrences where id = preview.id;
      end if;
    elsif had_preview
      and routine.schedule_kind <> 'after_completion'
      and preview.due_date = first_due_date
    then
      update public.routine_occurrences
      set role = 'current'
      where id = preview.id;
      current_occurrence_id := preview.id;
      second_due_date := private.next_routine_due_date(
        routine.schedule_rule,
        preview.due_date,
        null
      );
      if second_due_date is not null
        and (routine.active_until is null or second_due_date <= routine.active_until)
      then
        preview_occurrence_id := private.insert_open_routine_occurrence(
          routine,
          'preview',
          second_due_date,
          preview.planned_assignee_id
        );
      end if;
    else
      if had_preview then
        delete from public.routine_occurrences where id = preview.id;
      end if;
      current_occurrence_id := private.insert_open_routine_occurrence(
        routine,
        'current',
        first_due_date,
        occurrence.planned_assignee_id
      );
      select stored_occurrence.*
      into new_current
      from public.routine_occurrences as stored_occurrence
      where stored_occurrence.id = current_occurrence_id;
      second_due_date := private.next_routine_due_date(
        routine.schedule_rule,
        first_due_date,
        null
      );
      if second_due_date is not null
        and (routine.active_until is null or second_due_date <= routine.active_until)
      then
        preview_occurrence_id := private.insert_open_routine_occurrence(
          routine,
          'preview',
          second_due_date,
          new_current.planned_assignee_id
        );
      end if;
    end if;

    insert into public.activity_events (
      household_id,
      actor_member_id,
      kind,
      entity_type,
      entity_id,
      payload
    )
    values (
      routine.household_id,
      actor_member_id,
      case
        when p_command_kind = 'complete' then 'occurrence_completed'
        else 'occurrence_skipped'
      end,
      'routine_occurrence',
      occurrence.id,
      jsonb_strip_nulls(
        jsonb_build_object(
          'routine_id', routine.id,
          'due_date', occurrence.due_date,
          'completed_on', p_completed_on
        )
      )
    );
  end if;

  select stored_occurrence.id
  into current_occurrence_id
  from public.routine_occurrences as stored_occurrence
  where stored_occurrence.routine_id = routine.id
    and stored_occurrence.status = 'open'
    and stored_occurrence.role = 'current';

  select stored_occurrence.id
  into preview_occurrence_id
  from public.routine_occurrences as stored_occurrence
  where stored_occurrence.routine_id = routine.id
    and stored_occurrence.status = 'open'
    and stored_occurrence.role = 'preview';

  result := jsonb_strip_nulls(
    jsonb_build_object(
      'occurrence_id', occurrence.id,
      'routine_id', routine.id,
      'status', case
        when p_command_kind = 'complete' then 'completed'
        when p_command_kind = 'skip' then 'skipped'
        when p_command_kind = 'reschedule' then 'open'
      end,
      'current_occurrence_id', current_occurrence_id,
      'preview_occurrence_id', preview_occurrence_id
    )
  );

  insert into public.routine_command_receipts (
    household_id,
    idempotency_key,
    command_kind,
    occurrence_id,
    result
  )
  values (
    routine.household_id,
    p_idempotency_key,
    p_command_kind,
    occurrence.id,
    result
  );
  return result;
end;
$$;

create or replace function public.upsert_digest_preference(
  p_enabled boolean,
  p_local_time time
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  household uuid;
begin
  if actor_member_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_enabled is null or p_local_time is null then
    raise exception 'enabled and local time are required'
      using errcode = '22023';
  end if;
  select member.household_id
  into household
  from public.household_members as member
  where member.user_id = actor_member_id;
  if household is null then
    raise exception 'caller is not a household member' using errcode = '42501';
  end if;

  insert into public.notification_digest_preferences (
    household_id, member_id, enabled, local_time
  )
  values (household, actor_member_id, p_enabled, p_local_time)
  on conflict (household_id, member_id) do update
  set enabled = excluded.enabled,
      local_time = excluded.local_time;

  return jsonb_build_object(
    'household_id', household,
    'member_id', actor_member_id,
    'enabled', p_enabled,
    'local_time', p_local_time
  );
end;
$$;

create or replace function public.mark_inbox_notifications_read(
  p_notification_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  marked integer := 0;
begin
  if actor_member_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  update public.inbox_notifications as inbox
  set read_at = coalesce(inbox.read_at, now())
  where inbox.recipient_member_id = actor_member_id
    and inbox.id = any(coalesce(p_notification_ids, '{}'::uuid[]))
    and private.is_household_member(inbox.household_id);
  get diagnostics marked = row_count;
  return jsonb_build_object('marked', marked);
end;
$$;

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  household uuid;
  subscription public.push_subscriptions%rowtype;
begin
  if actor_member_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_endpoint is null or length(trim(p_endpoint)) not between 1 and 4000
    or p_p256dh is null or length(trim(p_p256dh)) not between 1 and 1000
    or p_auth is null or length(trim(p_auth)) not between 1 and 1000
  then
    raise exception 'endpoint, p256dh, and auth are required'
      using errcode = '22023';
  end if;
  select member.household_id into household
  from public.household_members as member
  where member.user_id = actor_member_id;
  if household is null then
    raise exception 'caller is not a household member' using errcode = '42501';
  end if;

  select stored_subscription.*
  into subscription
  from public.push_subscriptions as stored_subscription
  where stored_subscription.endpoint = trim(p_endpoint)
  for update;

  if found and subscription.member_id <> actor_member_id then
    raise exception 'push endpoint belongs to another member'
      using errcode = '42501';
  end if;

  if found then
    update public.push_subscriptions
    set p256dh = trim(p_p256dh),
        auth = trim(p_auth),
        user_agent = p_user_agent,
        last_seen_at = now(),
        disabled_at = null
    where id = subscription.id
    returning * into subscription;
  else
    insert into public.push_subscriptions (
      household_id, member_id, endpoint, p256dh, auth, user_agent
    )
    values (
      household,
      actor_member_id,
      trim(p_endpoint),
      trim(p_p256dh),
      trim(p_auth),
      p_user_agent
    )
    returning * into subscription;
  end if;

  return jsonb_build_object(
    'subscription_id', subscription.id,
    'disabled', false
  );
end;
$$;

create or replace function public.unregister_push_subscription(
  p_endpoint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  disabled integer := 0;
begin
  if actor_member_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_endpoint is null or length(trim(p_endpoint)) not between 1 and 4000 then
    raise exception 'push endpoint is required' using errcode = '22023';
  end if;
  update public.push_subscriptions as subscription
  set disabled_at = coalesce(subscription.disabled_at, now()),
      last_seen_at = now()
  where subscription.member_id = actor_member_id
    and subscription.endpoint = trim(p_endpoint);
  get diagnostics disabled = row_count;
  return jsonb_build_object('disabled', disabled);
end;
$$;

create or replace function public.run_deliver_due_reminders(
  p_schedule_key text,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim jsonb;
  candidate record;
  delivered integer := 0;
  inbox_id uuid;
  has_subscription boolean;
  zurich_date date := (now() at time zone 'Europe/Zurich')::date;
  zurich_time time := (now() at time zone 'Europe/Zurich')::time;
begin
  claim := private.claim_job(p_schedule_key, 'deliver_due_reminders');
  if claim ->> 'decision' in ('already_succeeded', 'in_progress') then
    return claim;
  end if;

  begin
    for candidate in
      select *
      from public.reminder_candidates as reminder
      where reminder.status = 'pending'
        and (
          reminder.remind_on < zurich_date
          or (
            reminder.remind_on = zurich_date
            and reminder.remind_local_time <= zurich_time
          )
        )
      order by reminder.remind_on, reminder.remind_local_time
      limit least(greatest(coalesce(p_limit, 100), 1), 100)
      for update skip locked
    loop
      insert into public.inbox_notifications (
        household_id,
        recipient_member_id,
        actor_member_id,
        kind,
        entity_type,
        entity_id,
        payload,
        dedupe_key
      )
      values (
        candidate.household_id,
        candidate.member_id,
        null,
        'routine_reminder',
        'routine_occurrence',
        candidate.occurrence_id,
        jsonb_build_object(
          'occurrence_id', candidate.occurrence_id,
          'remind_on', candidate.remind_on,
          'remind_local_time', candidate.remind_local_time
        ),
        'reminder:' || candidate.occurrence_id::text
      )
      on conflict (household_id, recipient_member_id, dedupe_key) do nothing
      returning id into inbox_id;

      update public.reminder_candidates
      set status = 'delivered'
      where id = candidate.id
        and status = 'pending';

      if inbox_id is not null then
        select exists (
          select 1
          from public.push_subscriptions as subscription
          where subscription.member_id = candidate.member_id
            and subscription.disabled_at is null
        ) into has_subscription;

        insert into public.push_outbox (
          household_id,
          recipient_member_id,
          inbox_notification_id,
          status,
          processed_at
        )
        values (
          candidate.household_id,
          candidate.member_id,
          inbox_id,
          case when has_subscription then 'pending' else 'skipped_no_subscription' end,
          case when has_subscription then null else now() end
        );
        delivered := delivered + 1;
      end if;
    end loop;

    perform private.complete_job_claim(
      p_schedule_key,
      jsonb_build_object('delivered', delivered)
    );
    return jsonb_build_object('decision', 'run', 'delivered', delivered);
  exception when others then
    perform private.fail_job_claim(p_schedule_key, SQLERRM);
    return jsonb_build_object('decision', 'failed', 'error', SQLERRM);
  end;
end;
$$;

create or replace function public.run_deliver_member_digests(
  p_schedule_key text,
  p_slot_local_time time,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim jsonb;
  pref record;
  delivered integer := 0;
  zurich_date date := (timezone('Europe/Zurich', now()))::date;
  body jsonb;
  inbox_id uuid;
  has_subscription boolean;
  overdue jsonb;
  due_today jsonb;
  meals jsonb;
  prep jsonb;
  groceries_active boolean;
  drafts jsonb;
begin
  claim := private.claim_job(p_schedule_key, 'deliver_member_digests');
  if claim ->> 'decision' in ('already_succeeded', 'in_progress') then
    return claim;
  end if;

  begin
    for pref in
      select *
      from public.notification_digest_preferences as preference
      where preference.enabled
        and extract(hour from preference.local_time)
          = extract(hour from p_slot_local_time)
        and extract(minute from preference.local_time)
          = extract(minute from p_slot_local_time)
      order by preference.household_id, preference.member_id
      limit least(greatest(coalesce(p_limit, 50), 1), 50)
      for update skip locked
    loop
      select coalesce(jsonb_agg(jsonb_build_object(
        'occurrenceId', occurrence.id,
        'title', routine.title,
        'dueDate', occurrence.due_date
      ) order by occurrence.due_date), '[]'::jsonb)
      into overdue
      from public.routine_occurrences as occurrence
      join public.routines as routine
        on routine.id = occurrence.routine_id
      where occurrence.household_id = pref.household_id
        and occurrence.status = 'open'
        and occurrence.role = 'current'
        and occurrence.due_date < zurich_date;

      select coalesce(jsonb_agg(jsonb_build_object(
        'occurrenceId', occurrence.id,
        'title', routine.title,
        'dueDate', occurrence.due_date
      ) order by routine.title), '[]'::jsonb)
      into due_today
      from public.routine_occurrences as occurrence
      join public.routines as routine
        on routine.id = occurrence.routine_id
      where occurrence.household_id = pref.household_id
        and occurrence.status = 'open'
        and occurrence.role = 'current'
        and occurrence.due_date = zurich_date;

      select coalesce(jsonb_agg(jsonb_build_object(
        'entryId', entry.id,
        'slot', entry.slot,
        'title', entry.title_snapshot
      ) order by entry.slot), '[]'::jsonb)
      into meals
      from public.meal_plan_entries as entry
      where entry.household_id = pref.household_id
        and entry.date = zurich_date
        and entry.slot is not null
        and entry.removed_at is null;

      select coalesce(jsonb_agg(jsonb_build_object(
        'id', occurrence.id,
        'title', routine.title
      )), '[]'::jsonb)
      into prep
      from public.routine_occurrences as occurrence
      join public.routines as routine
        on routine.id = occurrence.routine_id
      where occurrence.household_id = pref.household_id
        and occurrence.status = 'open'
        and occurrence.role = 'current'
        and occurrence.due_date = zurich_date
        and occurrence.meal_plan_entry_id is not null;

      select exists (
        select 1
        from public.grocery_items as item
        where item.household_id = pref.household_id
          and item.state in ('active', 'claimed')
      ) into groceries_active;

      select coalesce(jsonb_agg(jsonb_build_object(
        'draftId', draft.id,
        'description', draft.description,
        'amountCents', draft.amount_cents
      )), '[]'::jsonb)
      into drafts
      from public.expense_drafts as draft
      where draft.household_id = pref.household_id
        and draft.status = 'pending';

      body := jsonb_build_object(
        'overdueRoutines', overdue,
        'dueTodayRoutines', due_today,
        'todaysMeals', meals,
        'preparationTasks', prep,
        'groceriesActive', groceries_active,
        'pendingFinancialDrafts', drafts
      );

      if overdue = '[]'::jsonb
        and due_today = '[]'::jsonb
        and meals = '[]'::jsonb
        and prep = '[]'::jsonb
        and not groceries_active
        and drafts = '[]'::jsonb
      then
        continue;
      end if;

      insert into public.inbox_notifications (
        household_id,
        recipient_member_id,
        actor_member_id,
        kind,
        payload,
        dedupe_key
      )
      values (
        pref.household_id,
        pref.member_id,
        null,
        'household_digest',
        body,
        'digest:' || zurich_date::text
      )
      on conflict (household_id, recipient_member_id, dedupe_key) do nothing
      returning id into inbox_id;

      if inbox_id is null then
        continue;
      end if;

      select exists (
        select 1
        from public.push_subscriptions as subscription
        where subscription.member_id = pref.member_id
          and subscription.disabled_at is null
      ) into has_subscription;

      insert into public.push_outbox (
        household_id,
        recipient_member_id,
        inbox_notification_id,
        status,
        processed_at
      )
      values (
        pref.household_id,
        pref.member_id,
        inbox_id,
        case when has_subscription then 'pending' else 'skipped_no_subscription' end,
        case when has_subscription then null else now() end
      );
      delivered := delivered + 1;
    end loop;

    perform private.complete_job_claim(
      p_schedule_key,
      jsonb_build_object('delivered', delivered, 'slot', p_slot_local_time)
    );
    return jsonb_build_object('decision', 'run', 'delivered', delivered);
  exception when others then
    perform private.fail_job_claim(p_schedule_key, SQLERRM);
    return jsonb_build_object('decision', 'failed', 'error', SQLERRM);
  end;
end;
$$;

create or replace function public.run_retain_activity_events(
  p_schedule_key text,
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim jsonb;
  deleted integer := 0;
  doomed_item_ids uuid[];
begin
  claim := private.claim_job(p_schedule_key, 'retain_activity_events');
  if claim ->> 'decision' in ('already_succeeded', 'in_progress') then
    return claim;
  end if;
  begin
    with doomed as (
      select id
      from public.activity_events
      where created_at < now() - interval '90 days'
      order by created_at
      limit least(greatest(coalesce(p_limit, 500), 1), 500)
    )
    delete from public.activity_events as activity
    using doomed
    where activity.id = doomed.id;
    get diagnostics deleted = row_count;
    perform private.complete_job_claim(
      p_schedule_key,
      jsonb_build_object('deleted', deleted)
    );
    return jsonb_build_object('decision', 'run', 'deleted', deleted);
  exception when others then
    perform private.fail_job_claim(p_schedule_key, SQLERRM);
    return jsonb_build_object('decision', 'failed', 'error', SQLERRM);
  end;
end;
$$;

create or replace function public.run_retain_purchased_groceries(
  p_schedule_key text,
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim jsonb;
  deleted integer := 0;
begin
  claim := private.claim_job(p_schedule_key, 'retain_purchased_groceries');
  if claim ->> 'decision' in ('already_succeeded', 'in_progress') then
    return claim;
  end if;
  begin
    select coalesce(array_agg(doomed.id), '{}'::uuid[])
    into doomed_item_ids
    from (
      select id
      from public.grocery_items
      where state = 'purchased'
        and purchased_at < now() - interval '30 days'
      order by purchased_at
      limit least(greatest(coalesce(p_limit, 500), 1), 500)
    ) as doomed;

    delete from public.shopping_session_items
    where grocery_item_id = any(doomed_item_ids);

    delete from public.grocery_items
    where id = any(doomed_item_ids);
    get diagnostics deleted = row_count;
    perform private.complete_job_claim(
      p_schedule_key,
      jsonb_build_object('deleted', deleted)
    );
    return jsonb_build_object('decision', 'run', 'deleted', deleted);
  exception when others then
    perform private.fail_job_claim(p_schedule_key, SQLERRM);
    return jsonb_build_object('decision', 'failed', 'error', SQLERRM);
  end;
end;
$$;

create or replace function public.run_ensure_due_occurrences(
  p_schedule_key text,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim jsonb;
  ensured integer := 0;
  routine_row public.routines%rowtype;
begin
  claim := private.claim_job(p_schedule_key, 'ensure_due_occurrences');
  if claim ->> 'decision' in ('already_succeeded', 'in_progress') then
    return claim;
  end if;
  begin
    for routine_row in
      select routine.*
      from public.routines as routine
      where routine.archived_at is null
        and routine.paused_at is null
        and not exists (
          select 1
          from public.routine_occurrences as occurrence
          where occurrence.routine_id = routine.id
            and occurrence.status = 'open'
            and occurrence.role = 'current'
        )
      order by routine.updated_at
      limit least(greatest(coalesce(p_limit, 50), 1), 50)
      for update skip locked
    loop
      perform private.ensure_routine_window(routine_row.id, null, null);
      ensured := ensured + 1;
    end loop;
    perform private.complete_job_claim(
      p_schedule_key,
      jsonb_build_object('ensured', ensured)
    );
    return jsonb_build_object('decision', 'run', 'ensured', ensured);
  exception when others then
    perform private.fail_job_claim(p_schedule_key, SQLERRM);
    return jsonb_build_object('decision', 'failed', 'error', SQLERRM);
  end;
end;
$$;

create or replace function private.generate_due_recurring_drafts_for_household(
  p_household_id uuid,
  p_actor_member_id uuid,
  p_as_of date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  rule public.recurring_expense_rules%rowtype;
  due_on date;
  draft_id uuid;
  generated_count integer := 0;
  rule_generated_count integer;
begin
  if p_as_of is null then
    raise exception 'as_of date is required' using errcode = '22023';
  end if;
  if not private.member_belongs_to_household(
    p_household_id,
    p_actor_member_id
  ) then
    raise exception 'recurring draft actor is not a household member'
      using errcode = '42501';
  end if;

  for rule in
    select stored_rule.*
    from public.recurring_expense_rules as stored_rule
    where stored_rule.household_id = p_household_id
      and stored_rule.active
      and stored_rule.next_occurrence_on <= p_as_of
    order by stored_rule.id
    for update
  loop
    due_on := rule.next_occurrence_on;
    rule_generated_count := 0;
    while due_on <= p_as_of loop
      insert into public.expense_drafts (
        household_id,
        source_kind,
        description,
        amount_cents,
        payer_member_id,
        proposed_allocations,
        occurred_on,
        recurring_expense_rule_id,
        category_id
      )
      values (
        rule.household_id,
        'recurring',
        rule.description,
        rule.amount_cents,
        rule.payer_member_id,
        rule.proposed_allocations,
        due_on,
        rule.id,
        rule.category_id
      )
      on conflict (recurring_expense_rule_id, occurred_on)
        where recurring_expense_rule_id is not null
      do nothing
      returning id into draft_id;

      if draft_id is not null then
        generated_count := generated_count + 1;
        rule_generated_count := rule_generated_count + 1;
      end if;
      draft_id := null;
      due_on := private.next_recurring_expense_date(
        rule.schedule_kind,
        due_on,
        rule.iso_weekday,
        rule.day_of_month
      );
    end loop;

    update public.recurring_expense_rules
    set next_occurrence_on = due_on
    where id = rule.id;
    insert into public.activity_events (
      household_id,
      actor_member_id,
      kind,
      entity_type,
      entity_id,
      payload
    )
    values (
      rule.household_id,
      p_actor_member_id,
      'recurring_drafts_generated',
      'recurring_expense_rule',
      rule.id,
      jsonb_build_object(
        'generated_count', rule_generated_count,
        'as_of', p_as_of
      )
    );
  end loop;

  return generated_count;
end;
$$;

create or replace function public.run_generate_recurring_drafts_cron(
  p_schedule_key text,
  p_as_of date,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim jsonb;
  household record;
  actor uuid;
  generated integer := 0;
  batch_count integer := 0;
begin
  if p_as_of is null then
    raise exception 'as_of date is required' using errcode = '22023';
  end if;
  claim := private.claim_job(p_schedule_key, 'generate_recurring_drafts_cron');
  if claim ->> 'decision' in ('already_succeeded', 'in_progress') then
    return claim;
  end if;
  begin
    for household in
      select distinct rule.household_id
      from public.recurring_expense_rules as rule
      where rule.active
        and rule.next_occurrence_on <= p_as_of
      order by rule.household_id
      limit least(greatest(coalesce(p_limit, 50), 1), 50)
    loop
      select member.user_id into actor
      from public.household_members as member
      where member.household_id = household.household_id
      order by member.joined_at
      limit 1;
      if actor is null then
        continue;
      end if;
      generated := generated
        + private.generate_due_recurring_drafts_for_household(
        household.household_id,
        actor,
        p_as_of
      );
      batch_count := batch_count + 1;
    end loop;
    perform private.complete_job_claim(
      p_schedule_key,
      jsonb_build_object(
        'households', batch_count,
        'generated_draft_count', generated
      )
    );
    return jsonb_build_object(
      'decision', 'run',
      'households', batch_count,
      'generated_draft_count', generated
    );
  exception when others then
    perform private.fail_job_claim(p_schedule_key, SQLERRM);
    return jsonb_build_object('decision', 'failed', 'error', SQLERRM);
  end;
end;
$$;


alter table public.inbox_notifications enable row level security;
alter table public.notification_digest_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_outbox enable row level security;
alter table public.job_claims enable row level security;

revoke all on table public.inbox_notifications from public, anon, authenticated;
revoke all on table public.notification_digest_preferences from public, anon, authenticated;
revoke all on table public.push_subscriptions from public, anon, authenticated;
revoke all on table public.push_outbox from public, anon, authenticated;
revoke all on table public.job_claims from public, anon, authenticated;
revoke all on table public.inbox_notifications from service_role;
revoke all on table public.notification_digest_preferences from service_role;
revoke all on table public.push_subscriptions from service_role;
revoke all on table public.push_outbox from service_role;
revoke all on table public.job_claims from service_role;

grant select on table public.inbox_notifications to authenticated;
grant select, insert, update on table public.notification_digest_preferences to authenticated;
grant select, delete on table public.push_subscriptions to authenticated;
grant select, insert, update, delete
  on table public.inbox_notifications to service_role;
grant select, insert, update, delete
  on table public.notification_digest_preferences to service_role;
grant select, insert, update, delete
  on table public.push_subscriptions to service_role;
grant select, insert, update, delete
  on table public.push_outbox to service_role;
grant select, insert, update, delete
  on table public.job_claims to service_role;

create policy "members read own inbox"
on public.inbox_notifications
for select
to authenticated
using (
  recipient_member_id = (select auth.uid())
  and private.is_household_member(household_id)
);

create policy "members read household digest preferences"
on public.notification_digest_preferences
for select
to authenticated
using (private.is_household_member(household_id));

create policy "members upsert own digest preferences"
on public.notification_digest_preferences
for insert
to authenticated
with check (
  member_id = (select auth.uid())
  and private.is_household_member(household_id)
);

create policy "members update own digest preferences"
on public.notification_digest_preferences
for update
to authenticated
using (
  member_id = (select auth.uid())
  and private.is_household_member(household_id)
)
with check (
  member_id = (select auth.uid())
  and private.is_household_member(household_id)
);

create policy "members read own push subscriptions"
on public.push_subscriptions
for select
to authenticated
using (
  member_id = (select auth.uid())
  and private.is_household_member(household_id)
);

create policy "members delete own push subscriptions"
on public.push_subscriptions
for delete
to authenticated
using (
  member_id = (select auth.uid())
  and private.is_household_member(household_id)
);

revoke all on function private.member_belongs_to_household(uuid, uuid)
from public, anon, authenticated;
revoke all on function private.affected_members_for_routine_change(
  uuid, text, uuid, text, uuid
) from public, anon, authenticated;
revoke all on function private.insert_partner_inbox_and_outbox(
  uuid, uuid, uuid, text, text, uuid, jsonb
) from public, anon, authenticated;
revoke all on function private.deliver_partner_notice(
  uuid, uuid, text, text, uuid, jsonb, uuid[]
) from public, anon, authenticated;
revoke all on function private.cancel_inbox_reminder_for_occurrence(uuid)
from public, anon, authenticated;
revoke all on function private.claim_job(text, text)
from public, anon, authenticated;
revoke all on function private.complete_job_claim(text, jsonb)
from public, anon, authenticated;
revoke all on function private.fail_job_claim(text, text)
from public, anon, authenticated;
revoke all on function private.generate_due_recurring_drafts_for_household(
  uuid, uuid, date
) from public, anon, authenticated;

revoke all on function public.upsert_digest_preference(boolean, time)
from public, anon, authenticated;
revoke all on function public.mark_inbox_notifications_read(uuid[])
from public, anon, authenticated;
revoke all on function public.register_push_subscription(text, text, text, text)
from public, anon, authenticated;
revoke all on function public.unregister_push_subscription(text)
from public, anon, authenticated;
grant execute on function public.upsert_digest_preference(boolean, time) to authenticated;
grant execute on function public.mark_inbox_notifications_read(uuid[]) to authenticated;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.unregister_push_subscription(text) to authenticated;

revoke all on function public.run_deliver_due_reminders(text, integer) from public, anon, authenticated;
revoke all on function public.run_deliver_member_digests(text, time, integer) from public, anon, authenticated;
revoke all on function public.run_retain_activity_events(text, integer) from public, anon, authenticated;
revoke all on function public.run_retain_purchased_groceries(text, integer) from public, anon, authenticated;
revoke all on function public.run_ensure_due_occurrences(text, integer) from public, anon, authenticated;
revoke all on function public.run_generate_recurring_drafts_cron(text, date, integer) from public, anon, authenticated;
grant execute on function public.run_deliver_due_reminders(text, integer) to service_role;
grant execute on function public.run_deliver_member_digests(text, time, integer) to service_role;
grant execute on function public.run_retain_activity_events(text, integer) to service_role;
grant execute on function public.run_retain_purchased_groceries(text, integer) to service_role;
grant execute on function public.run_ensure_due_occurrences(text, integer) to service_role;
grant execute on function public.run_generate_recurring_drafts_cron(text, date, integer) to service_role;

do $pub$
begin
  alter publication supabase_realtime add table public.inbox_notifications;
exception when duplicate_object then null;
end;
$pub$;
do $pub$
begin
  alter publication supabase_realtime add table public.routine_occurrences;
exception when duplicate_object then null;
end;
$pub$;
do $pub$
begin
  alter publication supabase_realtime add table public.routines;
exception when duplicate_object then null;
end;
$pub$;
do $pub$
begin
  alter publication supabase_realtime add table public.meal_plan_entries;
exception when duplicate_object then null;
end;
$pub$;
do $pub$
begin
  alter publication supabase_realtime add table public.grocery_items;
exception when duplicate_object then null;
end;
$pub$;
do $pub$
begin
  alter publication supabase_realtime add table public.shopping_sessions;
exception when duplicate_object then null;
end;
$pub$;
do $pub$
begin
  alter publication supabase_realtime add table public.expense_drafts;
exception when duplicate_object then null;
end;
$pub$;
do $pub$
begin
  alter publication supabase_realtime add table public.financial_events;
exception when duplicate_object then null;
end;
$pub$;
do $pub$
begin
  alter publication supabase_realtime add table public.activity_events;
exception when duplicate_object then null;
end;
$pub$;

do $cron_extension$
begin
  execute 'create extension if not exists pg_cron with schema pg_catalog';
exception when others then
  null;
end;
$cron_extension$;

do $cron$
begin
  perform cron.schedule(
    'household-os-deliver-due-reminders',
    '* * * * *',
    $$select public.run_deliver_due_reminders(
      'deliver_due_reminders:global:' || to_char(timezone('Europe/Zurich', now()), 'YYYY-MM-DD"T"HH24-MI')
    );$$
  );
exception when others then
  null;
end;
$cron$;

do $cron$
begin
  perform cron.schedule(
    'household-os-retain-activity',
    '15 3 * * *',
    $$select public.run_retain_activity_events(
      'retain_activity_events:global:' || to_char(timezone('Europe/Zurich', now()), 'YYYY-MM-DD')
    );$$
  );
exception when others then
  null;
end;
$cron$;

do $cron$
begin
  perform cron.schedule(
    'household-os-retain-purchased-groceries',
    '20 3 * * *',
    $$select public.run_retain_purchased_groceries(
      'retain_purchased_groceries:global:' || to_char(timezone('Europe/Zurich', now()), 'YYYY-MM-DD')
    );$$
  );
exception when others then
  null;
end;
$cron$;

do $cron$
begin
  perform cron.schedule(
    'household-os-ensure-due-occurrences',
    '5 * * * *',
    $$select public.run_ensure_due_occurrences(
      'ensure_due_occurrences:global:' || to_char(timezone('Europe/Zurich', now()), 'YYYY-MM-DD"T"HH24')
    );$$
  );
exception when others then
  null;
end;
$cron$;

do $cron$
begin
  perform cron.schedule(
    'household-os-deliver-member-digests',
    '* * * * *',
    $$select public.run_deliver_member_digests(
      'deliver_member_digests:global:' || to_char(timezone('Europe/Zurich', now()), 'YYYY-MM-DD"T"HH24-MI'),
      date_trunc('minute', timezone('Europe/Zurich', now()))::time,
      50
    );$$
  );
exception when others then
  null;
end;
$cron$;

do $cron$
begin
  perform cron.schedule(
    'household-os-generate-recurring-drafts',
    '10 4 * * *',
    $$select public.run_generate_recurring_drafts_cron(
      'generate_recurring_drafts_cron:global:' || to_char(timezone('Europe/Zurich', now()), 'YYYY-MM-DD'),
      (timezone('Europe/Zurich', now()))::date,
      50
    );$$
  );
exception when others then
  null;
end;
$cron$;
