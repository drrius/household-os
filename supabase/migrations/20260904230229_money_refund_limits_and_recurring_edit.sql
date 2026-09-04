-- Preserve one starting-balance lineage while allowing immutable corrections.
-- The original anonymous CHECK follows the payer CHECK in the initial schema.
alter table public.financial_events drop constraint financial_events_check1;
alter table public.financial_events add constraint financial_events_related_event_check check (
  (type in ('refund', 'reversal', 'replacement') and related_event_id is not null)
  or (type in ('expense', 'settlement') and related_event_id is null)
  or type = 'opening_balance'
);
drop index public.financial_events_one_opening_balance_idx;
create unique index financial_events_one_opening_balance_idx
  on public.financial_events (household_id)
  where type = 'opening_balance' and related_event_id is null;
create unique index financial_events_one_opening_successor_idx
  on public.financial_events (related_event_id)
  where type = 'opening_balance' and related_event_id is not null;

create or replace function private.validate_opening_balance_lineage()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.type = 'opening_balance' and new.related_event_id is not null then
    if not exists (
      select 1 from public.financial_events as parent
      where parent.id = new.related_event_id and parent.household_id = new.household_id
        and parent.type = 'opening_balance'
    ) or not exists (
      select 1 from public.financial_events as reversal
      where reversal.related_event_id = new.related_event_id
        and reversal.household_id = new.household_id and reversal.type = 'reversal'
    ) then
      raise exception 'opening corrections require a reversed opening balance parent'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.validate_opening_balance_lineage() from public, anon, authenticated;
create trigger financial_events_opening_lineage
before insert on public.financial_events
for each row execute function private.validate_opening_balance_lineage();

-- Bound refunds to unreturned shares and provide an authorized recurring-rule editor.

create or replace function public.post_refund(
  p_related_event_id uuid,
  p_amount_cents bigint,
  p_allocations jsonb,
  p_occurred_on date,
  p_idempotency_key text,
  p_description text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid;
  related_event public.financial_events%rowtype;
  request_payload jsonb;
  prior_result jsonb;
  result jsonb;
  event_id uuid;
begin
  select stored_event.*
  into related_event
  from public.financial_events as stored_event
  where stored_event.id = p_related_event_id;
  if not found then
    raise exception 'related financial event % does not exist', p_related_event_id
      using errcode = 'P0002';
  end if;
  actor_member_id := private.require_money_actor(related_event.household_id);
  if related_event.type not in ('expense', 'replacement') then
    raise exception 'refunds must relate to an expense or replacement'
      using errcode = '22023';
  end if;

  request_payload := jsonb_build_object(
    'related_event_id', p_related_event_id,
    'amount_cents', p_amount_cents,
    'allocations', p_allocations,
    'occurred_on', p_occurred_on,
    'description', p_description,
    'note', p_note
  );
  prior_result := private.get_money_command_result(
    related_event.household_id, p_idempotency_key, 'post_refund',
    request_payload
  );
  if prior_result is not null then
    return prior_result;
  end if;

  -- All refund and source-correction commands serialize on the source expense.
  perform 1 from public.financial_events where id = related_event.id for update;
  if exists (select 1 from public.financial_events
    where related_event_id = related_event.id and type = 'reversal') then
    raise exception 'This expense has been reversed. Refund its replacement instead.'
      using errcode = '55000';
  end if;
  if p_amount_cents is null or p_amount_cents not between 1 and 9007199254740991 then
    raise exception 'Refund amount must be positive safe integer centimes'
      using errcode = '22023';
  end if;
  perform private.validate_money_allocations(related_event.household_id, p_amount_cents, p_allocations);
  if exists (
    select 1
    from jsonb_to_recordset(p_allocations) as requested("memberId" uuid, "allocatedCents" bigint)
    join public.financial_allocations as original
      on original.financial_event_id = related_event.id and original.member_id = requested."memberId"
    where requested."allocatedCents"::numeric > original.allocated_cents::numeric - coalesce((
      select sum(refunded.allocated_cents::numeric)
      from public.financial_events as refund
      join public.financial_allocations as refunded on refunded.financial_event_id = refund.id
      where refund.related_event_id = related_event.id and refund.type = 'refund'
        and refunded.member_id = original.member_id
        and not exists (select 1 from public.financial_events as reversal
          where reversal.related_event_id = refund.id and reversal.type = 'reversal')
    ), 0)
  ) then
    raise exception 'Refund shares exceed the remaining refundable shares. Refresh this expense.'
      using errcode = '23514';
  end if;

  event_id := private.post_financial_event(
    related_event.household_id, actor_member_id, 'refund',
    related_event.payer_member_id, p_description, p_amount_cents,
    p_allocations, p_occurred_on, related_event.id, related_event.category_id,
    p_note, null, null, null, 'refund_posted'
  );
  result := jsonb_build_object('financial_event_id', event_id);
  perform private.store_money_command_result(
    related_event.household_id, p_idempotency_key, 'post_refund',
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
  activity_event_id uuid;
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

  -- Lock the parent first when reversing a refund: the same ordering as post_refund.
  if target.type = 'refund' then
    perform 1 from public.financial_events where id = target.related_event_id for update;
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
  select child.id into reversal_event_id
  from public.financial_events as child
  where child.related_event_id = target.id and child.type = 'reversal';
  -- A reversed opening leaf may be repaired, but no ancestor can fork the lineage.
  if (reversal_event_id is not null and not (
      target.type = 'opening_balance' and p_replacement is not null
    )) or exists (
      select 1 from public.financial_events as child
      where child.related_event_id = target.id and child.type = 'opening_balance'
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
    and target.type not in ('expense', 'replacement', 'opening_balance')
  then
    raise exception
      'replacement corrections are only supported for expense or opening balance events'
      using errcode = '22023';
  end if;

  if target.type = 'opening_balance' and p_replacement is not null
    and p_replacement -> 'allocations' <> 'null'::jsonb then
    raise exception 'opening balance corrections do not accept expense allocations'
      using errcode = '22023';
  end if;

  if target.type in ('expense', 'replacement') and exists (
    select 1 from public.financial_events as refund
    where refund.related_event_id = target.id and refund.type = 'refund'
      and not exists (select 1 from public.financial_events as reversal
        where reversal.related_event_id = refund.id and reversal.type = 'reversal')
  ) then
    raise exception 'Reverse the active refunds before correcting this expense.'
      using errcode = '55000';
  end if;

  if reversal_event_id is null then
    reversal_event_id := private.post_financial_event(
    target.household_id, actor_member_id, 'reversal', null,
    'Reversal: ' || target.description, target.amount_cents, null,
    target.occurred_on, target.id, null, null, null, null, null, null
    );
  end if;

  if p_replacement is not null and target.type = 'opening_balance' then
    -- Opening balances store the creditor, never expense allocations or receipts.
    replacement_event_id := private.post_financial_event(
      target.household_id, actor_member_id, 'opening_balance',
      (p_replacement ->> 'payer_member_id')::uuid,
      p_replacement ->> 'description',
      (p_replacement ->> 'amount_cents')::bigint, null,
      (p_replacement ->> 'occurred_on')::date, target.id,
      null, p_replacement ->> 'note', null, null, null, null
    );
  elsif p_replacement is not null then
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
  )
  returning id into activity_event_id;
  perform private.deliver_partner_notice(
    target.household_id,
    actor_member_id,
    'financial_event_corrected',
    'financial_event',
    target.id,
    activity_payload,
    activity_event_id
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

alter table public.money_command_receipts drop constraint money_command_receipts_command_kind_check;
alter table public.money_command_receipts add constraint money_command_receipts_command_kind_check check (
  command_kind in ('establish_opening_balance', 'post_manual_expense', 'confirm_expense_draft',
  'dismiss_expense_draft', 'post_refund', 'record_settlement', 'correct_financial_event',
  'create_recurring_expense_rule', 'update_recurring_expense_rule', 'set_recurring_expense_rule_active',
  'generate_due_recurring_drafts')
);

create or replace function public.update_recurring_expense_rule(
  p_rule_id uuid,
  p_description text,
  p_amount_cents bigint,
  p_payer_member_id uuid,
  p_allocations jsonb,
  p_schedule_kind text,
  p_next_occurrence_on date,
  p_idempotency_key text,
  p_iso_weekday integer default null,
  p_day_of_month integer default null,
  p_category_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid;
  request_payload jsonb;
  prior_result jsonb;
  result jsonb;
  rule public.recurring_expense_rules%rowtype;
  p_household_id uuid;
begin
  select * into rule from public.recurring_expense_rules where id = p_rule_id;
  if not found then raise exception 'Recurring rule does not exist' using errcode = 'P0002'; end if;
  p_household_id := rule.household_id;
  actor_member_id := private.require_money_actor(p_household_id);
  if p_amount_cents is null
    or p_amount_cents not between 0 and 9007199254740991
  then
    raise exception 'amount_cents must be non-negative safe integer centimes'
      using errcode = '22023';
  end if;
  if p_description is null
    or length(trim(p_description)) not between 1 and 200
  then
    raise exception 'description must contain 1 to 200 characters'
      using errcode = '22023';
  end if;
  perform private.other_household_member(p_household_id, p_payer_member_id);
  perform private.validate_money_allocations(
    p_household_id, p_amount_cents, p_allocations
  );
  if p_next_occurrence_on is null then
    raise exception 'next_occurrence_on is required' using errcode = '22023';
  end if;
  if p_schedule_kind = 'weekly' then
    if p_iso_weekday is null or p_iso_weekday not between 1 and 7 then
      raise exception 'weekly schedules require an ISO weekday from 1 to 7'
        using errcode = '22023';
    end if;
    if extract(isodow from p_next_occurrence_on)::integer <> p_iso_weekday then
      raise exception 'next_occurrence_on must fall on the weekly weekday'
        using errcode = '22023';
    end if;
  elsif p_schedule_kind = 'monthly' then
    if p_day_of_month is null or p_day_of_month not between 1 and 31 then
      raise exception 'monthly schedules require a day of month from 1 to 31'
        using errcode = '22023';
    end if;
    if extract(day from p_next_occurrence_on)::integer
      <> least(
        p_day_of_month,
        extract(
          day from (
            date_trunc('month', p_next_occurrence_on) + interval '1 month - 1 day'
          )::date
        )::integer
      )
    then
      raise exception
        'next_occurrence_on must match the monthly day of month'
        using errcode = '22023';
    end if;
  else
    raise exception 'unknown recurring schedule kind %', p_schedule_kind
      using errcode = '22023';
  end if;

  request_payload := jsonb_build_object(
    'rule_id', p_rule_id,
    'description', p_description,
    'amount_cents', p_amount_cents,
    'payer_member_id', p_payer_member_id,
    'allocations', p_allocations,
    'schedule_kind', p_schedule_kind,
    'next_occurrence_on', p_next_occurrence_on,
    'iso_weekday', p_iso_weekday,
    'day_of_month', p_day_of_month,
    'category_id', p_category_id
  );
  prior_result := private.get_money_command_result(
    p_household_id, p_idempotency_key, 'update_recurring_expense_rule',
    request_payload
  );
  if prior_result is not null then
    return prior_result;
  end if;

  -- The row lock also serializes edits with due-draft generation. Existing drafts stay untouched.
  perform 1 from public.recurring_expense_rules where id = p_rule_id for update;
  if p_category_id is not null and not exists (
    select 1 from public.expense_categories where id = p_category_id and household_id = p_household_id
  ) then raise exception 'Choose a household category' using errcode = '22023'; end if;
  update public.recurring_expense_rules set
    description = trim(p_description), amount_cents = p_amount_cents,
    payer_member_id = p_payer_member_id, proposed_allocations = p_allocations,
    category_id = p_category_id, schedule_kind = p_schedule_kind,
    iso_weekday = case when p_schedule_kind = 'weekly' then p_iso_weekday else null end,
    day_of_month = case when p_schedule_kind = 'monthly' then p_day_of_month else null end,
    next_occurrence_on = p_next_occurrence_on, updated_at = now()
  where id = p_rule_id;

  insert into public.activity_events (
    household_id, actor_member_id, kind, entity_type, entity_id
  )
  values (
    p_household_id, actor_member_id, 'recurring_expense_rule_updated',
    'recurring_expense_rule', p_rule_id
  );
  result := jsonb_build_object('recurring_expense_rule_id', p_rule_id);
  perform private.store_money_command_result(
    p_household_id, p_idempotency_key, 'update_recurring_expense_rule',
    request_payload, result
  );
  return result;
end;
$$;

revoke all on function public.update_recurring_expense_rule(uuid, text, bigint, uuid, jsonb, text, date, text, integer, integer, uuid) from public, anon;
grant execute on function public.update_recurring_expense_rule(uuid, text, bigint, uuid, jsonb, text, date, text, integer, integer, uuid) to authenticated;
