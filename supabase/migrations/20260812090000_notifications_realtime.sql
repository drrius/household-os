create table public.inbox_notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipient_member_id uuid not null,
  actor_member_id uuid,
  kind text not null check (
    kind in ('partner_notice', 'routine_reminder', 'household_digest')
  ),
  activity_kind text,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null check (length(trim(dedupe_key)) between 1 and 300),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  unique (household_id, recipient_member_id, dedupe_key),
  foreign key (household_id, recipient_member_id)
    references public.household_members(household_id, user_id),
  foreign key (household_id, actor_member_id)
    references public.household_members(household_id, user_id),
  check (
    actor_member_id is null
    or recipient_member_id <> actor_member_id
  )
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
  endpoint text not null unique check (length(trim(endpoint)) between 1 and 4000),
  p256dh text not null check (length(trim(p256dh)) between 1 and 1000),
  auth text not null check (length(trim(auth)) between 1 and 1000),
  user_agent text check (user_agent is null or length(user_agent) <= 1000),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  unique (household_id, id),
  foreign key (household_id, member_id)
    references public.household_members(household_id, user_id) on delete cascade
);

create index push_subscriptions_active_member_idx
  on public.push_subscriptions (household_id, member_id)
  where disabled_at is null;

create table public.push_outbox (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipient_member_id uuid not null,
  inbox_notification_id uuid not null unique,
  status text not null default 'pending' check (
    status in ('pending', 'sent', 'skipped_no_subscription', 'failed')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  foreign key (household_id, recipient_member_id)
    references public.household_members(household_id, user_id),
  foreign key (household_id, inbox_notification_id)
    references public.inbox_notifications(household_id, id) on delete cascade,
  check (
    (status = 'pending' and processed_at is null)
    or status <> 'pending'
  )
);

create index push_outbox_pending_created_idx
  on public.push_outbox (created_at)
  where status = 'pending';

create table public.job_claims (
  schedule_key text primary key check (
    length(trim(schedule_key)) between 1 and 300
  ),
  job_kind text not null check (
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

create index job_claims_started_at_idx
  on public.job_claims (started_at desc);

create or replace function private.insert_inbox_and_outbox(
  p_household_id uuid,
  p_recipient_member_id uuid,
  p_actor_member_id uuid,
  p_kind text,
  p_activity_kind text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb,
  p_dedupe_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inbox_id uuid;
  outbox_status text;
begin
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
    p_kind,
    p_activity_kind,
    p_entity_type,
    p_entity_id,
    coalesce(p_payload, '{}'::jsonb),
    p_dedupe_key
  )
  on conflict (household_id, recipient_member_id, dedupe_key) do nothing
  returning id into inbox_id;

  if inbox_id is null then
    return null;
  end if;

  if exists (
    select 1
    from public.push_subscriptions as subscription
    where subscription.household_id = p_household_id
      and subscription.member_id = p_recipient_member_id
      and subscription.disabled_at is null
  ) then
    outbox_status := 'pending';
  else
    outbox_status := 'skipped_no_subscription';
  end if;

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
    case when outbox_status = 'pending' then null else now() end
  );

  return inbox_id;
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
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.insert_inbox_and_outbox(
    p_household_id,
    p_recipient_member_id,
    p_actor_member_id,
    'partner_notice',
    p_activity_kind,
    p_entity_type,
    p_entity_id,
    p_payload,
    'partner:' || p_activity_kind || ':' || p_entity_id::text
  );
$$;

create or replace function private.deliver_partner_notice(
  p_household_id uuid,
  p_actor_member_id uuid,
  p_activity_kind text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb,
  p_affect_member_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rule_outcome text;
  recipient_member_id uuid;
begin
  if not exists (
    select 1
    from public.household_members as member
    where member.household_id = p_household_id
      and member.user_id = p_actor_member_id
  ) then
    raise exception 'notification actor is not a member of household %',
      p_household_id
      using errcode = '42501';
  end if;

  rule_outcome := case p_activity_kind
    when 'routine_created' then 'activity_only'
    when 'routine_updated' then 'notify_affected_members'
    when 'occurrence_completed' then 'activity_only'
    when 'occurrence_skipped' then 'activity_only'
    when 'occurrence_rescheduled' then 'notify_affected_members'
    when 'routine_paused' then 'activity_only'
    when 'routine_unpaused' then 'activity_only'
    when 'routine_archived' then 'activity_only'
    when 'meal_plan_entry_created' then 'activity_only'
    when 'meal_plan_entry_updated' then 'activity_only'
    when 'meal_plan_entry_removed' then 'activity_only'
    when 'shopping_session_finished' then 'notify_other_member'
    when 'opening_balance_established' then 'notify_other_member'
    when 'expense_posted' then 'notify_other_member'
    when 'expense_draft_confirmed' then 'notify_other_member'
    when 'expense_draft_dismissed' then 'activity_only'
    when 'refund_posted' then 'notify_other_member'
    when 'settlement_recorded' then 'notify_other_member'
    when 'financial_event_corrected' then 'notify_other_member'
    when 'recurring_expense_rule_created' then 'activity_only'
    when 'recurring_expense_rule_updated' then 'activity_only'
    when 'recurring_drafts_generated' then 'activity_only'
    when 'direct_swap_completed' then 'notify_other_member'
    else null
  end;

  if rule_outcome is null then
    raise exception 'missing partner notification policy for %', p_activity_kind
      using errcode = '22023';
  end if;

  if rule_outcome = 'activity_only' then
    return;
  end if;

  if rule_outcome = 'notify_other_member' then
    recipient_member_id := private.other_household_member(
      p_household_id,
      p_actor_member_id
    );
    perform private.insert_partner_inbox_and_outbox(
      p_household_id,
      recipient_member_id,
      p_actor_member_id,
      p_activity_kind,
      p_entity_type,
      p_entity_id,
      p_payload
    );
    return;
  end if;

  for recipient_member_id in
    select distinct member.user_id
    from public.household_members as member
    join unnest(coalesce(p_affect_member_ids, '{}'::uuid[]))
      as affected(member_id)
      on affected.member_id = member.user_id
    where member.household_id = p_household_id
      and member.user_id <> p_actor_member_id
  loop
    perform private.insert_partner_inbox_and_outbox(
      p_household_id,
      recipient_member_id,
      p_actor_member_id,
      p_activity_kind,
      p_entity_type,
      p_entity_id,
      p_payload
    );
  end loop;
end;
$$;

create or replace function private.cancel_inbox_reminder_for_occurrence(
  p_occurrence_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.inbox_notifications
  where kind = 'routine_reminder'
    and dedupe_key = 'reminder:' || p_occurrence_id::text
    and read_at is null;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
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
    select coalesce(array_agg(member.user_id order by member.user_id), '{}'::uuid[])
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
    return jsonb_build_object(
      'decision', 'run',
      'schedule_key', claim.schedule_key,
      'attempt_count', claim.attempt_count
    );
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
        'schedule_key', claim.schedule_key,
        'attempt_count', claim.attempt_count,
        'result', claim.result
      );
    when 'started' then
      return jsonb_build_object(
        'decision', 'in_progress',
        'schedule_key', claim.schedule_key,
        'attempt_count', claim.attempt_count
      );
    when 'failed' then
      update public.job_claims
      set status = 'started',
          attempt_count = attempt_count + 1,
          result = null,
          last_error = null,
          started_at = now(),
          finished_at = null
      where schedule_key = p_schedule_key
      returning * into claim;
      return jsonb_build_object(
        'decision', 'retry_failed',
        'schedule_key', claim.schedule_key,
        'attempt_count', claim.attempt_count
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
      last_error = null,
      finished_at = now()
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
  actor_household_id uuid;
begin
  if actor_member_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;
  if p_enabled is null or p_local_time is null then
    raise exception 'enabled and local time are required'
      using errcode = '22023';
  end if;

  select member.household_id
  into actor_household_id
  from public.household_members as member
  where member.user_id = actor_member_id;

  if not found then
    raise exception 'caller is not a household member' using errcode = '42501';
  end if;

  insert into public.notification_digest_preferences (
    household_id,
    member_id,
    enabled,
    local_time
  )
  values (
    actor_household_id,
    actor_member_id,
    p_enabled,
    p_local_time
  )
  on conflict (household_id, member_id) do update
  set enabled = excluded.enabled,
      local_time = excluded.local_time;

  return jsonb_build_object(
    'household_id', actor_household_id,
    'member_id', actor_member_id,
    'enabled', p_enabled,
    'local_time', to_char(p_local_time, 'HH24:MI')
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
  updated_count integer;
begin
  if actor_member_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  update public.inbox_notifications
  set read_at = coalesce(read_at, now())
  where recipient_member_id = actor_member_id
    and id = any(coalesce(p_notification_ids, '{}'::uuid[]));

  get diagnostics updated_count = row_count;
  return jsonb_build_object('updated_count', updated_count);
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
  actor_household_id uuid;
  subscription public.push_subscriptions%rowtype;
begin
  if actor_member_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;
  if p_endpoint is null or length(trim(p_endpoint)) not between 1 and 4000
    or p_p256dh is null or length(trim(p_p256dh)) not between 1 and 1000
    or p_auth is null or length(trim(p_auth)) not between 1 and 1000
  then
    raise exception 'endpoint, p256dh, and auth are required'
      using errcode = '22023';
  end if;

  select member.household_id
  into actor_household_id
  from public.household_members as member
  where member.user_id = actor_member_id;

  if not found then
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
      household_id,
      member_id,
      endpoint,
      p256dh,
      auth,
      user_agent
    )
    values (
      actor_household_id,
      actor_member_id,
      trim(p_endpoint),
      trim(p_p256dh),
      trim(p_auth),
      p_user_agent
    )
    returning * into subscription;
  end if;

  return jsonb_build_object(
    'push_subscription_id', subscription.id,
    'endpoint', subscription.endpoint,
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
  updated_count integer;
begin
  if actor_member_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;
  if p_endpoint is null or length(trim(p_endpoint)) not between 1 and 4000 then
    raise exception 'endpoint is required' using errcode = '22023';
  end if;

  update public.push_subscriptions
  set disabled_at = coalesce(disabled_at, now()),
      last_seen_at = now()
  where member_id = actor_member_id
    and endpoint = trim(p_endpoint);

  get diagnostics updated_count = row_count;
  return jsonb_build_object(
    'endpoint', trim(p_endpoint),
    'disabled', updated_count > 0
  );
end;
$$;
-- M5: in-app inbox, digest prefs, push subscriptions, partner notify,
-- realtime publication, retention jobs, and Cron-safe runners.

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
  unique (household_id, recipient_member_id, dedupe_key),
  check (actor_member_id is null or recipient_member_id <> actor_member_id),
  foreign key (household_id, recipient_member_id)
    references public.household_members(household_id, user_id),
  foreign key (household_id, actor_member_id)
    references public.household_members(household_id, user_id)
);

create index inbox_notifications_recipient_created_idx
  on public.inbox_notifications (recipient_member_id, created_at desc);

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
  foreign key (household_id, member_id)
    references public.household_members(household_id, user_id) on delete cascade
);

create table public.push_outbox (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipient_member_id uuid not null,
  inbox_notification_id uuid not null
    references public.inbox_notifications(id) on delete cascade,
  status text not null default 'pending'
    check (
      status in ('pending', 'sent', 'skipped_no_subscription', 'failed')
    ),
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (inbox_notification_id),
  foreign key (household_id, recipient_member_id)
    references public.household_members(household_id, user_id)
);

create table public.job_claims (
  schedule_key text primary key,
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
  attempt_count integer not null default 1,
  result jsonb,
  last_error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
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
  p_household_id uuid,
  p_previous_policy text,
  p_previous_assigned uuid,
  p_next_policy text,
  p_next_assigned uuid
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result uuid[] := array[]::uuid[];
  member_id uuid;
begin
  if p_previous_policy = 'assigned' and p_previous_assigned is not null then
    result := array_append(result, p_previous_assigned);
  end if;
  if p_next_policy = 'assigned' and p_next_assigned is not null then
    result := array_append(result, p_next_assigned);
  end if;
  if p_previous_policy in ('alternating', 'shared')
    or p_next_policy in ('alternating', 'shared')
  then
    for member_id in
      select member.user_id
      from public.household_members as member
      where member.household_id = p_household_id
    loop
      result := array_append(result, member_id);
    end loop;
  end if;
  return result;
end;
$$;

create or replace function private.affected_members_for_occurrence_reschedule(
  p_household_id uuid,
  p_planned_assignee_id uuid
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result uuid[] := array[]::uuid[];
  member_id uuid;
begin
  if p_planned_assignee_id is not null then
    return array[p_planned_assignee_id];
  end if;
  for member_id in
    select member.user_id
    from public.household_members as member
    where member.household_id = p_household_id
  loop
    result := array_append(result, member_id);
  end loop;
  return result;
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

create or replace function private.activity_events_partner_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affect_ids uuid[] := array[]::uuid[];
begin
  if NEW.payload ? 'affect_member_ids'
    and jsonb_typeof(NEW.payload -> 'affect_member_ids') = 'array'
  then
    select coalesce(array_agg(value::uuid), array[]::uuid[])
    into affect_ids
    from jsonb_array_elements_text(NEW.payload -> 'affect_member_ids') as value;
  end if;

  perform private.deliver_partner_notice(
    NEW.household_id,
    NEW.actor_member_id,
    NEW.kind,
    NEW.entity_type,
    NEW.entity_id,
    NEW.payload,
    affect_ids
  );
  return NEW;
end;
$$;

create trigger activity_events_partner_notify
after insert on public.activity_events
for each row
execute function private.activity_events_partner_notify();

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
  existing public.job_claims%rowtype;
begin
  select * into existing
  from public.job_claims
  where schedule_key = p_schedule_key;

  if found then
    if existing.status = 'succeeded' then
      return jsonb_build_object(
        'decision', 'already_succeeded',
        'claim', to_jsonb(existing)
      );
    end if;
    if existing.status = 'started' then
      return jsonb_build_object(
        'decision', 'in_progress',
        'claim', to_jsonb(existing)
      );
    end if;
    if existing.status = 'failed' then
      update public.job_claims
      set status = 'started',
          attempt_count = existing.attempt_count + 1,
          last_error = null,
          finished_at = null,
          started_at = now()
      where schedule_key = p_schedule_key
      returning * into existing;
      return jsonb_build_object(
        'decision', 'retry_failed',
        'claim', to_jsonb(existing)
      );
    end if;
  end if;

  insert into public.job_claims (schedule_key, job_kind, status)
  values (p_schedule_key, p_job_kind, 'started')
  returning * into existing;

  return jsonb_build_object(
    'decision', 'run',
    'claim', to_jsonb(existing)
  );
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
      result = p_result,
      finished_at = now(),
      last_error = null
  where schedule_key = p_schedule_key;
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
      last_error = left(p_error, 500),
      finished_at = now()
  where schedule_key = p_schedule_key;
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
    or previous_routine.rotation_anchor_member_id is distinct from routine.rotation_anchor_member_id;

  if schedule_or_assignment_changed then
    affect_member_ids := private.affected_members_for_routine_change(
      routine.household_id,
      previous_routine.assignment_policy,
      previous_routine.assigned_member_id,
      routine.assignment_policy,
      routine.assigned_member_id
    );
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
    'routine_updated',
    'routine',
    routine.id,
    jsonb_build_object(
      'schedule_kind', routine.schedule_kind,
      'assignment_policy', routine.assignment_policy,
      'affect_member_ids', to_jsonb(affect_member_ids)
    )
  );

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
      jsonb_build_object(
        'routine_id', routine.id,
        'from_due_date', occurrence.due_date,
        'to_due_date', p_new_due_date,
        'affect_member_ids', to_jsonb(
          private.affected_members_for_occurrence_reschedule(
            routine.household_id,
            occurrence.planned_assignee_id
          )
        )
      )
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
    and inbox.id = any(p_notification_ids)
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
  subscription_id uuid;
begin
  if actor_member_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_endpoint is null or length(trim(p_endpoint)) = 0 then
    raise exception 'push endpoint is required' using errcode = '22023';
  end if;
  select member.household_id into household
  from public.household_members as member
  where member.user_id = actor_member_id;
  if household is null then
    raise exception 'caller is not a household member' using errcode = '42501';
  end if;

  insert into public.push_subscriptions (
    household_id, member_id, endpoint, p256dh, auth, user_agent
  )
  values (
    household, actor_member_id, p_endpoint, p_p256dh, p_auth, p_user_agent
  )
  on conflict (endpoint) do update
  set household_id = excluded.household_id,
      member_id = excluded.member_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      last_seen_at = now(),
      disabled_at = null
  returning id into subscription_id;

  return jsonb_build_object('subscription_id', subscription_id);
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
  removed integer := 0;
begin
  if actor_member_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  delete from public.push_subscriptions as subscription
  where subscription.member_id = actor_member_id
    and subscription.endpoint = p_endpoint;
  get diagnostics removed = row_count;
  return jsonb_build_object('removed', removed);
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
      limit greatest(p_limit, 1)
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
    raise;
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
        and preference.local_time = p_slot_local_time
      order by preference.household_id, preference.member_id
      limit greatest(p_limit, 1)
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
    raise;
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
      limit greatest(p_limit, 1)
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
    raise;
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
    with doomed as (
      select id
      from public.grocery_items
      where state = 'purchased'
        and purchased_at < now() - interval '30 days'
      order by purchased_at
      limit greatest(p_limit, 1)
    )
    delete from public.grocery_items as item
    using doomed
    where item.id = doomed.id;
    get diagnostics deleted = row_count;
    perform private.complete_job_claim(
      p_schedule_key,
      jsonb_build_object('deleted', deleted)
    );
    return jsonb_build_object('decision', 'run', 'deleted', deleted);
  exception when others then
    perform private.fail_job_claim(p_schedule_key, SQLERRM);
    raise;
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
  first_due date;
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
      limit greatest(p_limit, 1)
      for update skip locked
    loop
      first_due := private.first_routine_due_date(
        routine_row.schedule_rule,
        greatest(
          private.household_today(),
          coalesce(routine_row.active_from, private.household_today())
        )
      );
      if first_due is not null then
        perform private.ensure_routine_window(routine_row.id, first_due, null);
        ensured := ensured + 1;
      end if;
    end loop;
    perform private.complete_job_claim(
      p_schedule_key,
      jsonb_build_object('ensured', ensured)
    );
    return jsonb_build_object('decision', 'run', 'ensured', ensured);
  exception when others then
    perform private.fail_job_claim(p_schedule_key, SQLERRM);
    raise;
  end;
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
  result jsonb;
begin
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
      limit greatest(p_limit, 1)
    loop
      select member.user_id into actor
      from public.household_members as member
      where member.household_id = household.household_id
      order by member.joined_at
      limit 1;
      if actor is null then
        continue;
      end if;
      perform set_config('request.jwt.claim.sub', actor::text, true);
      perform set_config('request.jwt.claim.role', 'authenticated', true);
      result := public.generate_due_recurring_drafts(
        household.household_id,
        p_as_of,
        'cron:' || p_schedule_key || ':' || household.household_id::text
      );
      generated := generated + coalesce((result ->> 'generated_draft_count')::integer, 0);
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
    raise;
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

grant select on table public.inbox_notifications to authenticated;
grant select, insert, update on table public.notification_digest_preferences to authenticated;
grant select on table public.push_subscriptions to authenticated;

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

revoke all on function public.upsert_digest_preference(boolean, time) from public, anon;
revoke all on function public.mark_inbox_notifications_read(uuid[]) from public, anon;
revoke all on function public.register_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.unregister_push_subscription(text) from public, anon;
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
grant execute on function public.generate_due_recurring_drafts(uuid, date, text) to service_role;

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

do $cron$
begin
  perform cron.schedule(
    'household-os-deliver-due-reminders',
    '* * * * *',
    $$select public.run_deliver_due_reminders(
      'deliver_due_reminders:global:' || to_char(timezone('Europe/Zurich', now()), 'YYYY-MM-DD"T"HH24-MI')
    );$$
  );
exception when undefined_table or undefined_function or invalid_schema_name then
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
exception when undefined_table or undefined_function or invalid_schema_name then
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
exception when undefined_table or undefined_function or invalid_schema_name then
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
exception when undefined_table or undefined_function or invalid_schema_name then
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
      (timezone('Europe/Zurich', now()))::time,
      50
    );$$
  );
exception when undefined_table or undefined_function or invalid_schema_name then
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
exception when undefined_table or undefined_function or invalid_schema_name then
  null;
end;
$cron$;
