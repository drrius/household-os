-- Each rule mutation, including due-draft generation and pause/resume, advances its edit version.
create function private.advance_recurring_expense_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
revoke all on function private.advance_recurring_expense_version() from public, anon, authenticated;
drop trigger recurring_expense_rules_set_updated_at on public.recurring_expense_rules;
create trigger recurring_expense_rules_set_updated_at
before update on public.recurring_expense_rules
for each row execute function private.advance_recurring_expense_version();

-- The former no-version overload remains unavailable to every API caller.
revoke all on function public.update_recurring_expense_rule(uuid, text, bigint, uuid, jsonb, text, date, text, integer, integer, uuid) from public, anon, authenticated;

create or replace function public.update_recurring_expense_rule(
  p_rule_id uuid,
  p_expected_updated_at timestamptz,
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
  if p_expected_updated_at is null then
    raise exception 'Reload this recurring expense before editing' using errcode = '22023';
  end if;
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
    'expected_updated_at', p_expected_updated_at,
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
  select * into rule from public.recurring_expense_rules where id = p_rule_id for update;
  if rule.updated_at is distinct from p_expected_updated_at then
    raise exception 'This recurring expense changed. Reopen it before saving.' using errcode = '40001';
  end if;
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

revoke all on function public.update_recurring_expense_rule(uuid, timestamptz, text, bigint, uuid, jsonb, text, date, text, integer, integer, uuid) from public, anon;
grant execute on function public.update_recurring_expense_rule(uuid, timestamptz, text, bigint, uuid, jsonb, text, date, text, integer, integer, uuid) to authenticated;
