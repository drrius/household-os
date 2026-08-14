alter table public.push_outbox
  add column claim_token uuid,
  add column claimed_at timestamptz,
  add column claim_expires_at timestamptz,
  add column delivered_subscription_ids uuid[] not null default '{}'::uuid[];

alter table public.push_outbox
  add constraint push_outbox_claim_lease_check check (
    (claim_token is null and claimed_at is null and claim_expires_at is null)
    or (
      claim_token is not null
      and claimed_at is not null
      and claim_expires_at is not null
      and claim_expires_at > claimed_at
    )
  );

create index push_outbox_pending_claim_idx
  on public.push_outbox (claim_expires_at, created_at, id)
  where status = 'pending';

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
      outbox.delivered_subscription_ids
  )
  select
    claimed.id,
    claimed.recipient_member_id,
    claimed.inbox_notification_id,
    claimed.household_id,
    claimed.attempt_count,
    claimed.claim_token,
    claimed.delivered_subscription_ids,
    jsonb_build_object(
      'id', notification.id,
      'kind', notification.kind,
      'activity_kind', notification.activity_kind,
      'entity_type', notification.entity_type
    ) as inbox
  from claimed
  join public.inbox_notifications as notification
    on notification.household_id = claimed.household_id
   and notification.id = claimed.inbox_notification_id
  order by notification.created_at, claimed.id;
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

revoke all on function public.claim_push_outbox(integer, integer, uuid[])
  from public, anon, authenticated;
revoke all on function public.finalize_push_outbox_claim(uuid, uuid, text, text, uuid[])
  from public, anon, authenticated;
grant execute on function public.claim_push_outbox(integer, integer, uuid[])
  to service_role;
grant execute on function public.finalize_push_outbox_claim(uuid, uuid, text, text, uuid[])
  to service_role;

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

create or replace function private.invoke_push_dispatch()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  dispatch_url text;
  service_key text;
  request_id bigint;
begin
  select secrets.decrypted_secret
  into dispatch_url
  from vault.decrypted_secrets as secrets
  where secrets.name = 'push_dispatch_url';

  select secrets.decrypted_secret
  into service_key
  from vault.decrypted_secrets as secrets
  where secrets.name in (
    'push_dispatch_secret_key',
    'push_dispatch_service_role_key'
  )
  order by case secrets.name
    when 'push_dispatch_secret_key' then 0
    else 1
  end
  limit 1;

  if dispatch_url is null or btrim(dispatch_url) = '' then
    return null;
  end if;

  if service_key is null or btrim(service_key) = '' then
    return null;
  end if;

  select net.http_post(
    url := dispatch_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', service_key
    ),
    timeout_milliseconds := 15000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function private.invoke_push_dispatch() from public, anon, authenticated;
grant execute on function private.invoke_push_dispatch() to service_role;

do $cron$
begin
  perform cron.schedule(
    'household-os-invoke-push-dispatch',
    '* * * * *',
    $$select private.invoke_push_dispatch();$$
  );
exception when others then
  null;
end;
$cron$;
