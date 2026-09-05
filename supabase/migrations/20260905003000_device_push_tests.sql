-- Device tests share the existing capped dispatcher, but never create Inbox activity.
alter table public.push_subscriptions
  add constraint push_subscriptions_household_member_id_key
  unique (household_id, member_id, id);
alter table public.push_outbox
  alter column inbox_notification_id drop not null,
  add column test_subscription_id uuid,
  add constraint push_outbox_exactly_one_source check (
    num_nonnulls(inbox_notification_id, test_subscription_id) = 1
  ),
  add constraint push_outbox_test_device_fk
    foreign key (household_id, recipient_member_id, test_subscription_id)
    references public.push_subscriptions(household_id, member_id, id) on delete cascade;

create index push_outbox_test_subscription_idx
  on public.push_outbox(test_subscription_id) where test_subscription_id is not null;

-- Quota evidence survives device deletion and outbox cleanup. Only the owner RPC
-- prunes entries older than two days, outside the rolling 24-hour quota window.
create table public.device_push_test_requests (
  id uuid primary key,
  household_id uuid not null,
  member_id uuid not null,
  subscription_id uuid not null,
  endpoint_hash bytea not null check (octet_length(endpoint_hash) = 32),
  created_at timestamptz not null default now(),
  foreign key (household_id, member_id)
    references public.household_members(household_id, user_id) on delete cascade
);
create index device_push_test_requests_member_created_idx
  on public.device_push_test_requests(member_id, created_at desc);
alter table public.device_push_test_requests enable row level security;
revoke all on public.device_push_test_requests from public, anon, authenticated, service_role;

create or replace function public.read_self_device_push_test(p_endpoint text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to check this device' using errcode = '42501';
  end if;
  if p_request_id is null or p_endpoint is null or length(p_endpoint) not between 1 and 4000 then
    raise exception 'Invalid device test request' using errcode = '22023';
  end if;
  select jsonb_build_object('id', outbox.id, 'status', case
    when outbox.status = 'sent' then 'accepted'
    when outbox.status in ('failed', 'skipped_no_subscription') then 'failed'
    else 'queued' end)
  into result
  from public.push_outbox as outbox
  join public.push_subscriptions as subscription
    on subscription.household_id = outbox.household_id
    and subscription.member_id = outbox.recipient_member_id
    and subscription.id = outbox.test_subscription_id
  join public.household_members as member
    on member.household_id = outbox.household_id and member.user_id = auth.uid()
  where outbox.id = p_request_id and outbox.recipient_member_id = auth.uid()
    and subscription.endpoint = p_endpoint;
  if result is null then
    raise exception 'Test not available for this device' using errcode = '42501';
  end if;
  return result;
end;
$$;

create or replace function public.enqueue_self_device_push_test(p_endpoint text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  member_household uuid;
  device public.push_subscriptions%rowtype;
  prior public.device_push_test_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to test this device' using errcode = '42501';
  end if;
  if p_request_id is null or p_endpoint is null or length(p_endpoint) not between 1 and 4000 then
    raise exception 'Invalid device test request' using errcode = '22023';
  end if;
  -- Always lock member before subscription: quotas serialize across devices.
  select household_id into member_household from public.household_members
    where user_id = auth.uid() for update;
  if member_household is null then
    raise exception 'Household membership required' using errcode = '42501';
  end if;
  select * into device from public.push_subscriptions
    where household_id = member_household and member_id = auth.uid()
      and endpoint = p_endpoint for update;
  if not found then
    raise exception 'Enable push on this device first' using errcode = '22023';
  end if;
  select * into prior from public.device_push_test_requests where id = p_request_id;
  if found then
    if prior.household_id <> member_household or prior.member_id <> auth.uid()
      or prior.subscription_id <> device.id then
      raise exception 'Test request could not be used' using errcode = '22023';
    end if;
    return public.read_self_device_push_test(p_endpoint, p_request_id);
  end if;
  if device.disabled_at is not null then
    raise exception 'Enable push on this device first' using errcode = '22023';
  end if;
  if exists (select 1 from public.device_push_test_requests
    where member_id = auth.uid() and endpoint_hash = extensions.digest(p_endpoint, 'sha256')
      and created_at > now() - interval '1 minute') then
    raise exception 'Wait one minute before testing this device again' using errcode = '22023';
  end if;
  if (select count(*) from public.device_push_test_requests
    where member_id = auth.uid() and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Five tests in 24 hours is the limit. Try again tomorrow' using errcode = '22023';
  end if;
  delete from public.device_push_test_requests
    where member_id = auth.uid() and created_at < now() - interval '2 days';
  delete from public.push_outbox
    where recipient_member_id = auth.uid() and test_subscription_id is not null
      and created_at < now() - interval '2 days'
      and (claim_token is null or claim_expires_at <= now());
  begin
    insert into public.device_push_test_requests(id, household_id, member_id, subscription_id, endpoint_hash)
      values (p_request_id, member_household, auth.uid(), device.id, extensions.digest(p_endpoint, 'sha256'));
    insert into public.push_outbox(id, household_id, recipient_member_id, test_subscription_id)
      values (p_request_id, member_household, auth.uid(), device.id);
  exception when unique_violation then
    raise exception 'Test request could not be used' using errcode = '22023';
  end;
  return public.read_self_device_push_test(p_endpoint, p_request_id);
end;
$$;
revoke all on function public.read_self_device_push_test(text, uuid) from public, anon;
revoke all on function public.enqueue_self_device_push_test(text, uuid) from public, anon;
grant execute on function public.read_self_device_push_test(text, uuid) to authenticated;
grant execute on function public.enqueue_self_device_push_test(text, uuid) to authenticated;

create or replace function public.claim_push_outbox(
  p_limit integer default 50,
  p_lease_seconds integer default 120,
  p_excluded_ids uuid[] default '{}'::uuid[]
)
returns table (
  id uuid,
  recipient_member_id uuid,
  inbox_notification_id uuid,
  household_id uuid,
  attempt_count integer,
  claim_token uuid,
  delivered_subscription_ids uuid[],
  inbox jsonb
)
language sql
volatile
security definer
set search_path = ''
as $$
  with candidates as materialized (
    select
      outbox.id,
      extensions.gen_random_uuid() as next_claim_token
    from public.push_outbox as outbox
    where outbox.status = 'pending'
      and not (
        outbox.id = any(coalesce(p_excluded_ids, '{}'::uuid[]))
      )
      and (
        outbox.claim_token is null
        or outbox.claim_expires_at <= now()
      )
    order by outbox.created_at, outbox.id
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
    for update skip locked
  ),
  claimed as (
    update public.push_outbox as outbox
    set
      claim_token = candidate.next_claim_token,
      claimed_at = now(),
      claim_expires_at = now() + make_interval(
        secs => least(greatest(coalesce(p_lease_seconds, 120), 30), 900)
      )
    from candidates as candidate
    where outbox.id = candidate.id
    returning
      outbox.id,
      outbox.recipient_member_id,
      outbox.inbox_notification_id,
      outbox.household_id,
      outbox.attempt_count,
      outbox.claim_token,
      outbox.delivered_subscription_ids,
      outbox.test_subscription_id,
      outbox.created_at
  )
  select
    claimed.id,
    claimed.recipient_member_id,
    claimed.inbox_notification_id,
    claimed.household_id,
    claimed.attempt_count,
    claimed.claim_token,
    claimed.delivered_subscription_ids,
    case when claimed.test_subscription_id is not null then jsonb_build_object(
      'id', claimed.id, 'kind', 'device_test',
      'test_subscription_id', claimed.test_subscription_id,
      'activity_kind', null, 'entity_type', null
    ) else jsonb_build_object(
      'id', notification.id,
      'kind', notification.kind,
      'activity_kind', notification.activity_kind,
      'entity_type', notification.entity_type
    ) end as inbox
  from claimed
  left join public.inbox_notifications as notification
    on notification.household_id = claimed.household_id
   and notification.id = claimed.inbox_notification_id
  order by claimed.created_at, claimed.id;
$$;

create or replace function public.run_drain_push_outbox(
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
  outbox_row record;
  skipped integer := 0;
  awaiting_edge integer := 0;
  has_subscription boolean;
begin
  claim := private.claim_job(p_schedule_key, 'drain_push_outbox');
  if claim ->> 'decision' in ('already_succeeded', 'in_progress') then
    return claim;
  end if;

  begin
    for outbox_row in
      select *
      from public.push_outbox as outbox
      where outbox.status = 'pending'
        and (
          outbox.claim_token is null
          or outbox.claim_expires_at <= now()
        )
      order by outbox.created_at
      limit least(greatest(coalesce(p_limit, 50), 1), 100)
      for update skip locked
    loop
      select exists (
        select 1
        from public.push_subscriptions as subscription
        where subscription.household_id = outbox_row.household_id
          and subscription.member_id = outbox_row.recipient_member_id
          and subscription.disabled_at is null
          and (outbox_row.test_subscription_id is null
            or subscription.id = outbox_row.test_subscription_id)
      )
      into has_subscription;

      if not has_subscription then
        update public.push_outbox
        set
          status = 'skipped_no_subscription',
          last_error = null,
          processed_at = now(),
          claim_token = null,
          claimed_at = null,
          claim_expires_at = null
        where id = outbox_row.id;
        skipped := skipped + 1;
      else
        update public.push_outbox
        set
          claim_token = null,
          claimed_at = null,
          claim_expires_at = null
        where id = outbox_row.id;
        awaiting_edge := awaiting_edge + 1;
      end if;
    end loop;

    perform private.complete_job_claim(
      p_schedule_key,
      jsonb_build_object('skipped', skipped, 'awaiting_edge', awaiting_edge)
    );
    return jsonb_build_object(
      'decision', 'run',
      'skipped', skipped,
      'awaiting_edge', awaiting_edge
    );
  exception when others then
    perform private.fail_job_claim(p_schedule_key, SQLERRM);
    return jsonb_build_object('decision', 'failed', 'error', SQLERRM);
  end;
end;
$$;


create or replace function public.finalize_push_outbox_claim(
  p_outbox_id uuid,
  p_claim_token uuid,
  p_outcome text,
  p_error text default null,
  p_delivered_subscription_ids uuid[] default '{}'::uuid[]
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  claimed public.push_outbox%rowtype;
  merged_delivered_ids uuid[];
begin
  if p_outcome not in ('sent', 'skipped_no_subscription', 'failed', 'deferred') then
    raise exception 'unknown push outbox outcome %', p_outcome
      using errcode = '22023';
  end if;

  select outbox.*
  into claimed
  from public.push_outbox as outbox
  where outbox.id = p_outbox_id
    and outbox.status = 'pending'
    and outbox.claim_token = p_claim_token
  for update;

  if not found then
    return false;
  end if;

  if claimed.test_subscription_id is not null and exists (
    select 1 from unnest(coalesce(p_delivered_subscription_ids, '{}'::uuid[])) as delivered(id)
    where delivered.id <> claimed.test_subscription_id
  ) then
    raise exception 'delivered subscription is not the test device' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_delivered_subscription_ids, '{}'::uuid[])) as delivered(id)
    join public.push_subscriptions as subscription
      on subscription.id = delivered.id
    where subscription.household_id <> claimed.household_id
       or subscription.member_id <> claimed.recipient_member_id
  ) then
    raise exception 'delivered subscription does not belong to claimed recipient'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct delivered.id order by delivered.id), '{}'::uuid[])
  into merged_delivered_ids
  from unnest(
    claimed.delivered_subscription_ids
    || coalesce(p_delivered_subscription_ids, '{}'::uuid[])
  ) as delivered(id);

  update public.push_outbox as outbox
  set
    status = case
      when p_outcome = 'sent' then 'sent'
      when p_outcome = 'skipped_no_subscription' then 'skipped_no_subscription'
      when p_outcome = 'failed' and outbox.attempt_count + 1 >= 5 then 'failed'
      else 'pending'
    end,
    attempt_count = case
      when p_outcome = 'failed' then outbox.attempt_count + 1
      else outbox.attempt_count
    end,
    last_error = case
      when p_outcome in ('failed', 'deferred') then left(p_error, 1000)
      else null
    end,
    processed_at = case
      when p_outcome in ('sent', 'skipped_no_subscription')
        or (p_outcome = 'failed' and outbox.attempt_count + 1 >= 5)
      then now()
      else null
    end,
    claim_token = null,
    claimed_at = null,
    claim_expires_at = null,
    delivered_subscription_ids = merged_delivered_ids
  where outbox.id = claimed.id
    and outbox.claim_token = p_claim_token;

  return found;
end;
$$;

