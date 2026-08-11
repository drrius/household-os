create table public.expense_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  sort_order integer not null check (sort_order >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, id)
);

create unique index expense_categories_active_name_idx
  on public.expense_categories (household_id, name)
  where archived_at is null;

create table public.financial_events (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  type text not null check (
    type in (
      'opening_balance',
      'expense',
      'refund',
      'settlement',
      'reversal',
      'replacement'
    )
  ),
  occurred_on date not null,
  created_at timestamptz not null default now(),
  created_by_member_id uuid not null,
  payer_member_id uuid,
  description text not null check (length(trim(description)) between 1 and 200),
  amount_cents bigint not null
    check (amount_cents between 0 and 9007199254740991),
  related_event_id uuid,
  category_id uuid,
  note text check (note is null or length(note) <= 4000),
  receipt_path text check (receipt_path is null or length(receipt_path) <= 2000),
  shopping_session_id uuid,
  expense_draft_id uuid unique,
  unique (household_id, id),
  foreign key (household_id, created_by_member_id)
    references public.household_members(household_id, user_id),
  foreign key (household_id, payer_member_id)
    references public.household_members(household_id, user_id),
  foreign key (household_id, related_event_id)
    references public.financial_events(household_id, id),
  foreign key (household_id, category_id)
    references public.expense_categories(household_id, id),
  foreign key (household_id, shopping_session_id)
    references public.shopping_sessions(household_id, id),
  foreign key (household_id, expense_draft_id)
    references public.expense_drafts(household_id, id),
  check (
    (type = 'reversal' and payer_member_id is null)
    or (type <> 'reversal' and payer_member_id is not null)
  ),
  check (
    (type in ('refund', 'reversal', 'replacement') and related_event_id is not null)
    or (
      type in ('opening_balance', 'expense', 'settlement')
      and related_event_id is null
    )
  )
);

create unique index financial_events_one_opening_balance_idx
  on public.financial_events (household_id)
  where type = 'opening_balance';

create unique index financial_events_one_reversal_idx
  on public.financial_events (related_event_id)
  where type = 'reversal';

create index financial_events_household_occurred_idx
  on public.financial_events (household_id, occurred_on desc, created_at desc);

create table public.financial_allocations (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  financial_event_id uuid not null,
  member_id uuid not null,
  allocated_cents bigint not null
    check (allocated_cents between 0 and 9007199254740991),
  unique (household_id, id),
  unique (financial_event_id, member_id),
  foreign key (household_id, financial_event_id)
    references public.financial_events(household_id, id),
  foreign key (household_id, member_id)
    references public.household_members(household_id, user_id)
);

create table public.ledger_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  financial_event_id uuid not null,
  member_id uuid not null,
  receivable_delta_cents bigint not null
    check (
      receivable_delta_cents between -9007199254740991 and 9007199254740991
    ),
  created_at timestamptz not null default now(),
  unique (household_id, id),
  unique (financial_event_id, member_id),
  foreign key (household_id, financial_event_id)
    references public.financial_events(household_id, id),
  foreign key (household_id, member_id)
    references public.household_members(household_id, user_id)
);

create index ledger_entries_household_member_idx
  on public.ledger_entries (household_id, member_id);

create table public.recurring_expense_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  description text not null check (length(trim(description)) between 1 and 200),
  amount_cents bigint not null
    check (amount_cents between 0 and 9007199254740991),
  payer_member_id uuid not null,
  proposed_allocations jsonb not null
    check (jsonb_typeof(proposed_allocations) = 'array'),
  category_id uuid,
  schedule_kind text not null check (schedule_kind in ('weekly', 'monthly')),
  iso_weekday smallint check (iso_weekday between 1 and 7),
  day_of_month smallint check (day_of_month between 1 and 31),
  active boolean not null default true,
  next_occurrence_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, payer_member_id)
    references public.household_members(household_id, user_id),
  foreign key (household_id, category_id)
    references public.expense_categories(household_id, id),
  check (
    (schedule_kind = 'weekly' and iso_weekday is not null and day_of_month is null)
    or (
      schedule_kind = 'monthly'
      and iso_weekday is null
      and day_of_month is not null
    )
  )
);

alter table public.expense_drafts
  add column recurring_expense_rule_id uuid;

alter table public.expense_drafts
  add column category_id uuid;

alter table public.expense_drafts
  add foreign key (household_id, recurring_expense_rule_id)
  references public.recurring_expense_rules(household_id, id);

alter table public.expense_drafts
  add foreign key (household_id, category_id)
  references public.expense_categories(household_id, id);

create unique index expense_drafts_rule_occurrence_idx
  on public.expense_drafts (recurring_expense_rule_id, occurred_on)
  where recurring_expense_rule_id is not null;

create table public.money_command_receipts (
  household_id uuid not null references public.households(id) on delete cascade,
  idempotency_key text not null check (
    length(trim(idempotency_key)) between 1 and 200
  ),
  command_kind text not null check (
    command_kind in (
      'establish_opening_balance',
      'post_manual_expense',
      'confirm_expense_draft',
      'dismiss_expense_draft',
      'post_refund',
      'record_settlement',
      'correct_financial_event',
      'create_recurring_expense_rule',
      'set_recurring_expense_rule_active',
      'generate_due_recurring_drafts'
    )
  ),
  request_payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (household_id, idempotency_key)
);

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
      'recurring_drafts_generated'
    )
  );

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
      'expense_category'
    )
  );

create or replace function private.seed_default_expense_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.expense_categories (household_id, name, sort_order)
  values
    (new.id, 'Groceries', 1),
    (new.id, 'Dining', 2),
    (new.id, 'Home', 3),
    (new.id, 'Pet', 4),
    (new.id, 'Utilities', 5),
    (new.id, 'Rent', 6),
    (new.id, 'Other', 7)
  on conflict (household_id, name) where archived_at is null do nothing;
  return new;
end;
$$;

create trigger households_seed_default_expense_categories
after insert on public.households
for each row
execute function private.seed_default_expense_categories();

insert into public.expense_categories (household_id, name, sort_order)
select household.id, defaults.name, defaults.sort_order
from public.households as household
cross join (
  values
    ('Groceries'::text, 1),
    ('Dining'::text, 2),
    ('Home'::text, 3),
    ('Pet'::text, 4),
    ('Utilities'::text, 5),
    ('Rent'::text, 6),
    ('Other'::text, 7)
) as defaults(name, sort_order)
on conflict (household_id, name) where archived_at is null do nothing;

create or replace function private.set_money_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger recurring_expense_rules_set_updated_at
before update on public.recurring_expense_rules
for each row
execute function private.set_money_updated_at();

create or replace function private.reject_financial_history_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'financial history is append-only'
    using errcode = '55000';
end;
$$;

create trigger financial_events_are_append_only
before update or delete on public.financial_events
for each row
execute function private.reject_financial_history_change();

create trigger financial_allocations_are_append_only
before update or delete on public.financial_allocations
for each row
execute function private.reject_financial_history_change();

create trigger ledger_entries_are_append_only
before update or delete on public.ledger_entries
for each row
execute function private.reject_financial_history_change();

create trigger money_command_receipts_are_append_only
before update or delete on public.money_command_receipts
for each row
execute function private.reject_financial_history_change();

create or replace function private.enforce_ledger_entries_zero_sum()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  unbalanced_event_id uuid;
begin
  select inserted.financial_event_id
  into unbalanced_event_id
  from (
    select distinct financial_event_id
    from inserted_ledger_entries
  ) as inserted
  join public.ledger_entries as entry
    on entry.financial_event_id = inserted.financial_event_id
  group by inserted.financial_event_id
  having sum(entry.receivable_delta_cents) <> 0
  limit 1;

  if unbalanced_event_id is not null then
    raise exception 'ledger entries for event % must sum to zero',
      unbalanced_event_id
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create trigger ledger_entries_enforce_zero_sum
after insert on public.ledger_entries
referencing new table as inserted_ledger_entries
for each statement
execute function private.enforce_ledger_entries_zero_sum();

create or replace function private.require_money_actor(p_household_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
begin
  if actor_member_id is null
    or not private.is_household_member(p_household_id)
  then
    raise exception 'caller is not a member of household %', p_household_id
      using errcode = '42501';
  end if;
  return actor_member_id;
end;
$$;

create or replace function private.other_household_member(
  p_household_id uuid,
  p_member_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  other_member_id uuid;
  member_count integer;
begin
  select count(*)::integer
  into member_count
  from public.household_members as member
  where member.household_id = p_household_id;

  select member.user_id
  into other_member_id
  from public.household_members as member
  where member.household_id = p_household_id
    and member.user_id <> p_member_id
  limit 1;

  if member_count <> 2 or other_member_id is null then
    raise exception 'money commands require exactly two household members'
      using errcode = '23514';
  end if;
  return other_member_id;
end;
$$;

create or replace function private.validate_money_allocations(
  p_household_id uuid,
  p_amount_cents bigint,
  p_allocations jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  allocation jsonb;
  allocation_count integer := 0;
  allocation_total numeric := 0;
  distinct_member_count integer;
begin
  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'allocations must be a JSON array'
      using errcode = '22023';
  end if;
  if jsonb_array_length(p_allocations) <> 2 then
    raise exception 'allocations must contain both household members'
      using errcode = '22023';
  end if;

  for allocation in select value from jsonb_array_elements(p_allocations)
  loop
    if jsonb_typeof(allocation) <> 'object'
      or jsonb_typeof(allocation -> 'memberId') <> 'string'
      or jsonb_typeof(allocation -> 'allocatedCents') <> 'number'
      or (allocation ->> 'allocatedCents') !~ '^[0-9]+$'
      or (allocation ->> 'allocatedCents')::numeric > 9007199254740991
    then
      raise exception 'each allocation requires a memberId and safe integer allocatedCents'
        using errcode = '22023';
    end if;
    allocation_count := allocation_count + 1;
    allocation_total :=
      allocation_total + (allocation ->> 'allocatedCents')::numeric;
  end loop;

  select count(distinct member.user_id)::integer
  into distinct_member_count
  from public.household_members as member
  join jsonb_to_recordset(p_allocations)
    as item("memberId" uuid, "allocatedCents" bigint)
    on item."memberId" = member.user_id
  where member.household_id = p_household_id;

  if allocation_count <> 2 or distinct_member_count <> 2 then
    raise exception 'allocations must name both household members exactly once'
      using errcode = '22023';
  end if;
  if allocation_total <> p_amount_cents then
    raise exception 'allocation total must equal amount_cents'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function private.get_money_command_result(
  p_household_id uuid,
  p_idempotency_key text,
  p_command_kind text,
  p_request_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt public.money_command_receipts%rowtype;
begin
  if p_idempotency_key is null
    or length(trim(p_idempotency_key)) not between 1 and 200
  then
    raise exception 'idempotency key must contain 1 to 200 characters'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_household_id::text || ':' || p_idempotency_key, 0)
  );

  select stored_receipt.*
  into receipt
  from public.money_command_receipts as stored_receipt
  where stored_receipt.household_id = p_household_id
    and stored_receipt.idempotency_key = p_idempotency_key;

  if not found then
    return null;
  end if;
  if receipt.command_kind <> p_command_kind
    or receipt.request_payload <> p_request_payload
  then
    raise exception 'idempotency key was already used for a different command'
      using errcode = '22023';
  end if;
  return receipt.result;
end;
$$;

create or replace function private.store_money_command_result(
  p_household_id uuid,
  p_idempotency_key text,
  p_command_kind text,
  p_request_payload jsonb,
  p_result jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.money_command_receipts (
    household_id,
    idempotency_key,
    command_kind,
    request_payload,
    result
  )
  values (
    p_household_id,
    p_idempotency_key,
    p_command_kind,
    p_request_payload,
    p_result
  );
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
      jsonb_build_object('financial_event_type', p_type)
    );
  end if;
  return event_id;
end;
$$;

create or replace function private.next_recurring_expense_date(
  p_schedule_kind text,
  p_current_date date,
  p_iso_weekday integer,
  p_day_of_month integer
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  first_candidate date;
  weekday_offset integer;
  candidate_year integer;
  candidate_month integer;
  this_month date;
  next_month date;
  final_day integer;
begin
  if p_schedule_kind = 'weekly' then
    if p_iso_weekday is null or p_iso_weekday not between 1 and 7 then
      raise exception 'weekly schedules require an ISO weekday from 1 to 7'
        using errcode = '22023';
    end if;
    first_candidate := p_current_date + 1;
    weekday_offset := (
      p_iso_weekday - extract(isodow from first_candidate)::integer + 7
    ) % 7;
    return first_candidate + weekday_offset;
  end if;
  if p_schedule_kind <> 'monthly' then
    raise exception 'unknown recurring schedule kind %', p_schedule_kind
      using errcode = '22023';
  end if;
  if p_day_of_month is null or p_day_of_month not between 1 and 31 then
    raise exception 'monthly schedules require a day of month from 1 to 31'
      using errcode = '22023';
  end if;

  candidate_year := extract(year from p_current_date)::integer;
  candidate_month := extract(month from p_current_date)::integer;
  final_day := extract(
    day from (
      make_date(candidate_year, candidate_month, 1) + interval '1 month - 1 day'
    )::date
  )::integer;
  this_month := make_date(
    candidate_year,
    candidate_month,
    least(p_day_of_month, final_day)
  );
  if this_month > p_current_date then
    return this_month;
  end if;

  next_month := (date_trunc('month', p_current_date) + interval '1 month')::date;
  final_day := extract(
    day from (next_month + interval '1 month - 1 day')::date
  )::integer;
  return make_date(
    extract(year from next_month)::integer,
    extract(month from next_month)::integer,
    least(p_day_of_month, final_day)
  );
end;
$$;

create or replace function public.establish_opening_balance(
  p_household_id uuid,
  p_creditor_member_id uuid,
  p_amount_cents bigint,
  p_occurred_on date,
  p_description text,
  p_idempotency_key text,
  p_note text default null
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
  event_id uuid;
begin
  actor_member_id := private.require_money_actor(p_household_id);
  request_payload := jsonb_build_object(
    'household_id', p_household_id,
    'creditor_member_id', p_creditor_member_id,
    'amount_cents', p_amount_cents,
    'occurred_on', p_occurred_on,
    'description', p_description,
    'note', p_note
  );
  prior_result := private.get_money_command_result(
    p_household_id,
    p_idempotency_key,
    'establish_opening_balance',
    request_payload
  );
  if prior_result is not null then
    return prior_result;
  end if;

  event_id := private.post_financial_event(
    p_household_id, actor_member_id, 'opening_balance',
    p_creditor_member_id, p_description, p_amount_cents, null,
    p_occurred_on, null, null, p_note, null, null, null,
    'opening_balance_established'
  );
  result := jsonb_build_object('financial_event_id', event_id);
  perform private.store_money_command_result(
    p_household_id, p_idempotency_key, 'establish_opening_balance',
    request_payload, result
  );
  return result;
end;
$$;

create or replace function public.post_manual_expense(
  p_household_id uuid,
  p_description text,
  p_amount_cents bigint,
  p_payer_member_id uuid,
  p_allocations jsonb,
  p_occurred_on date,
  p_idempotency_key text,
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
  request_payload jsonb;
  prior_result jsonb;
  result jsonb;
  event_id uuid;
begin
  actor_member_id := private.require_money_actor(p_household_id);
  request_payload := jsonb_build_object(
    'household_id', p_household_id,
    'description', p_description,
    'amount_cents', p_amount_cents,
    'payer_member_id', p_payer_member_id,
    'allocations', p_allocations,
    'occurred_on', p_occurred_on,
    'category_id', p_category_id,
    'note', p_note,
    'receipt_path', p_receipt_path
  );
  prior_result := private.get_money_command_result(
    p_household_id, p_idempotency_key, 'post_manual_expense', request_payload
  );
  if prior_result is not null then
    return prior_result;
  end if;

  event_id := private.post_financial_event(
    p_household_id, actor_member_id, 'expense', p_payer_member_id,
    p_description, p_amount_cents, p_allocations, p_occurred_on,
    null, p_category_id, p_note, p_receipt_path, null, null,
    'expense_posted'
  );
  result := jsonb_build_object('financial_event_id', event_id);
  perform private.store_money_command_result(
    p_household_id, p_idempotency_key, 'post_manual_expense',
    request_payload, result
  );
  return result;
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

  insert into public.activity_events (
    household_id, actor_member_id, kind, entity_type, entity_id, payload
  )
  values (
    draft.household_id, actor_member_id, 'expense_draft_confirmed',
    'expense_draft', draft.id,
    jsonb_build_object('financial_event_id', event_id)
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

create or replace function public.dismiss_expense_draft(
  p_draft_id uuid,
  p_idempotency_key text
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
  request_payload := jsonb_build_object('draft_id', p_draft_id);
  prior_result := private.get_money_command_result(
    draft.household_id, p_idempotency_key, 'dismiss_expense_draft',
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
  if draft.status = 'posted' then
    raise exception 'posted expense drafts cannot be dismissed'
      using errcode = '55000';
  end if;
  if draft.status = 'pending' then
    update public.expense_drafts set status = 'dismissed' where id = draft.id;
    insert into public.activity_events (
      household_id, actor_member_id, kind, entity_type, entity_id
    )
    values (
      draft.household_id, actor_member_id, 'expense_draft_dismissed',
      'expense_draft', draft.id
    );
  end if;
  result := jsonb_build_object('expense_draft_id', draft.id, 'status', 'dismissed');
  perform private.store_money_command_result(
    draft.household_id, p_idempotency_key, 'dismiss_expense_draft',
    request_payload, result
  );
  return result;
end;
$$;

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

create or replace function public.record_settlement(
  p_household_id uuid,
  p_payer_member_id uuid,
  p_amount_cents bigint,
  p_occurred_on date,
  p_description text,
  p_idempotency_key text,
  p_note text default null
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
  event_id uuid;
begin
  actor_member_id := private.require_money_actor(p_household_id);
  request_payload := jsonb_build_object(
    'household_id', p_household_id,
    'payer_member_id', p_payer_member_id,
    'amount_cents', p_amount_cents,
    'occurred_on', p_occurred_on,
    'description', p_description,
    'note', p_note
  );
  prior_result := private.get_money_command_result(
    p_household_id, p_idempotency_key, 'record_settlement', request_payload
  );
  if prior_result is not null then
    return prior_result;
  end if;

  event_id := private.post_financial_event(
    p_household_id, actor_member_id, 'settlement', p_payer_member_id,
    p_description, p_amount_cents, null, p_occurred_on, null, null,
    p_note, null, null, null, 'settlement_recorded'
  );
  result := jsonb_build_object('financial_event_id', event_id);
  perform private.store_money_command_result(
    p_household_id, p_idempotency_key, 'record_settlement',
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

  insert into public.activity_events (
    household_id, actor_member_id, kind, entity_type, entity_id, payload
  )
  values (
    target.household_id, actor_member_id, 'financial_event_corrected',
    'financial_event', target.id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'reversal_event_id', reversal_event_id,
        'replacement_event_id', replacement_event_id
      )
    )
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

create or replace function public.create_recurring_expense_rule(
  p_household_id uuid,
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
  rule_id uuid;
begin
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
    'household_id', p_household_id,
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
    p_household_id, p_idempotency_key, 'create_recurring_expense_rule',
    request_payload
  );
  if prior_result is not null then
    return prior_result;
  end if;

  insert into public.recurring_expense_rules (
    household_id, description, amount_cents, payer_member_id,
    proposed_allocations, category_id, schedule_kind, iso_weekday,
    day_of_month, next_occurrence_on
  )
  values (
    p_household_id, trim(p_description), p_amount_cents, p_payer_member_id,
    p_allocations, p_category_id, p_schedule_kind, p_iso_weekday,
    p_day_of_month, p_next_occurrence_on
  )
  returning id into rule_id;

  insert into public.activity_events (
    household_id, actor_member_id, kind, entity_type, entity_id
  )
  values (
    p_household_id, actor_member_id, 'recurring_expense_rule_created',
    'recurring_expense_rule', rule_id
  );
  result := jsonb_build_object('recurring_expense_rule_id', rule_id);
  perform private.store_money_command_result(
    p_household_id, p_idempotency_key, 'create_recurring_expense_rule',
    request_payload, result
  );
  return result;
end;
$$;

create or replace function public.set_recurring_expense_rule_active(
  p_rule_id uuid,
  p_active boolean,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid;
  rule public.recurring_expense_rules%rowtype;
  request_payload jsonb;
  prior_result jsonb;
  result jsonb;
begin
  select stored_rule.*
  into rule
  from public.recurring_expense_rules as stored_rule
  where stored_rule.id = p_rule_id;
  if not found then
    raise exception 'recurring expense rule % does not exist', p_rule_id
      using errcode = 'P0002';
  end if;
  actor_member_id := private.require_money_actor(rule.household_id);
  if p_active is null then
    raise exception 'active state is required' using errcode = '22023';
  end if;
  request_payload := jsonb_build_object('rule_id', p_rule_id, 'active', p_active);
  prior_result := private.get_money_command_result(
    rule.household_id, p_idempotency_key, 'set_recurring_expense_rule_active',
    request_payload
  );
  if prior_result is not null then
    return prior_result;
  end if;

  update public.recurring_expense_rules
  set active = p_active
  where id = rule.id;
  insert into public.activity_events (
    household_id, actor_member_id, kind, entity_type, entity_id, payload
  )
  values (
    rule.household_id, actor_member_id, 'recurring_expense_rule_updated',
    'recurring_expense_rule', rule.id, jsonb_build_object('active', p_active)
  );
  result := jsonb_build_object(
    'recurring_expense_rule_id', rule.id,
    'active', p_active
  );
  perform private.store_money_command_result(
    rule.household_id, p_idempotency_key, 'set_recurring_expense_rule_active',
    request_payload, result
  );
  return result;
end;
$$;

create or replace function public.generate_due_recurring_drafts(
  p_household_id uuid,
  p_as_of date,
  p_idempotency_key text
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
  due_on date;
  draft_id uuid;
  generated_count integer := 0;
  rule_generated_count integer;
begin
  actor_member_id := private.require_money_actor(p_household_id);
  if p_as_of is null then
    raise exception 'as_of date is required' using errcode = '22023';
  end if;
  request_payload := jsonb_build_object(
    'household_id', p_household_id,
    'as_of', p_as_of
  );
  prior_result := private.get_money_command_result(
    p_household_id, p_idempotency_key, 'generate_due_recurring_drafts',
    request_payload
  );
  if prior_result is not null then
    return prior_result;
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
        household_id, source_kind, description, amount_cents,
        payer_member_id, proposed_allocations, occurred_on,
        recurring_expense_rule_id, category_id
      )
      values (
        rule.household_id, 'recurring', rule.description, rule.amount_cents,
        rule.payer_member_id, rule.proposed_allocations, due_on, rule.id,
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
        rule.schedule_kind, due_on, rule.iso_weekday, rule.day_of_month
      );
    end loop;

    update public.recurring_expense_rules
    set next_occurrence_on = due_on
    where id = rule.id;
    insert into public.activity_events (
      household_id, actor_member_id, kind, entity_type, entity_id, payload
    )
    values (
      rule.household_id, actor_member_id, 'recurring_drafts_generated',
      'recurring_expense_rule', rule.id,
      jsonb_build_object('generated_count', rule_generated_count, 'as_of', p_as_of)
    );
  end loop;

  result := jsonb_build_object('generated_draft_count', generated_count);
  perform private.store_money_command_result(
    p_household_id, p_idempotency_key, 'generate_due_recurring_drafts',
    request_payload, result
  );
  return result;
end;
$$;

alter table public.expense_categories enable row level security;
alter table public.financial_events enable row level security;
alter table public.financial_allocations enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.recurring_expense_rules enable row level security;
alter table public.money_command_receipts enable row level security;

create policy "members can read expense categories"
on public.expense_categories for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "members can create expense categories"
on public.expense_categories for insert to authenticated
with check ((select private.is_household_member(household_id)));

create policy "members can update expense categories"
on public.expense_categories for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));

create policy "members can read financial events"
on public.financial_events for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "members can read financial allocations"
on public.financial_allocations for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "members can read ledger entries"
on public.ledger_entries for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "members can read recurring expense rules"
on public.recurring_expense_rules for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "members can read money command receipts"
on public.money_command_receipts for select to authenticated
using ((select private.is_household_member(household_id)));

revoke all on table public.expense_categories from anon, authenticated;
revoke all on table public.financial_events from anon, authenticated;
revoke all on table public.financial_allocations from anon, authenticated;
revoke all on table public.ledger_entries from anon, authenticated;
revoke all on table public.recurring_expense_rules from anon, authenticated;
revoke all on table public.money_command_receipts from anon, authenticated;

grant select, insert on table public.expense_categories to authenticated;
grant update (name, sort_order, archived_at)
  on table public.expense_categories to authenticated;
grant select on table public.financial_events to authenticated;
grant select on table public.financial_allocations to authenticated;
grant select on table public.ledger_entries to authenticated;
grant select on table public.recurring_expense_rules to authenticated;
grant select on table public.money_command_receipts to authenticated;

revoke all on table public.expense_categories from service_role;
revoke all on table public.financial_events from service_role;
revoke all on table public.financial_allocations from service_role;
revoke all on table public.ledger_entries from service_role;
revoke all on table public.recurring_expense_rules from service_role;
revoke all on table public.money_command_receipts from service_role;

grant select, insert, update, delete
  on table public.expense_categories to service_role;
grant select, insert on table public.financial_events to service_role;
grant select, insert on table public.financial_allocations to service_role;
grant select, insert on table public.ledger_entries to service_role;
grant select, insert, update, delete
  on table public.recurring_expense_rules to service_role;
grant select, insert on table public.money_command_receipts to service_role;

revoke all on function private.seed_default_expense_categories()
from public, anon, authenticated;
revoke all on function private.set_money_updated_at()
from public, anon, authenticated;
revoke all on function private.reject_financial_history_change()
from public, anon, authenticated;
revoke all on function private.enforce_ledger_entries_zero_sum()
from public, anon, authenticated;
revoke all on function private.require_money_actor(uuid)
from public, anon, authenticated;
revoke all on function private.other_household_member(uuid, uuid)
from public, anon, authenticated;
revoke all on function private.validate_money_allocations(uuid, bigint, jsonb)
from public, anon, authenticated;
revoke all on function private.get_money_command_result(uuid, text, text, jsonb)
from public, anon, authenticated;
revoke all on function private.store_money_command_result(
  uuid, text, text, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function private.post_financial_event(
  uuid, uuid, text, uuid, text, bigint, jsonb, date, uuid, uuid,
  text, text, uuid, uuid, text
) from public, anon, authenticated;
revoke all on function private.next_recurring_expense_date(
  text, date, integer, integer
) from public, anon, authenticated;

revoke execute on function public.establish_opening_balance(
  uuid, uuid, bigint, date, text, text, text
) from public, anon;
revoke execute on function public.post_manual_expense(
  uuid, text, bigint, uuid, jsonb, date, text, uuid, text, text
) from public, anon;
revoke execute on function public.confirm_expense_draft(
  uuid, text, bigint, uuid, jsonb, date, uuid, text, text
) from public, anon;
revoke execute on function public.dismiss_expense_draft(uuid, text)
from public, anon;
revoke execute on function public.post_refund(
  uuid, bigint, jsonb, date, text, text, text
) from public, anon;
revoke execute on function public.record_settlement(
  uuid, uuid, bigint, date, text, text, text
) from public, anon;
revoke execute on function public.correct_financial_event(uuid, text, jsonb)
from public, anon;
revoke execute on function public.create_recurring_expense_rule(
  uuid, text, bigint, uuid, jsonb, text, date, text, integer, integer, uuid
) from public, anon;
revoke execute on function public.set_recurring_expense_rule_active(
  uuid, boolean, text
) from public, anon;
revoke execute on function public.generate_due_recurring_drafts(uuid, date, text)
from public, anon;

grant execute on function public.establish_opening_balance(
  uuid, uuid, bigint, date, text, text, text
) to authenticated;
grant execute on function public.post_manual_expense(
  uuid, text, bigint, uuid, jsonb, date, text, uuid, text, text
) to authenticated;
grant execute on function public.confirm_expense_draft(
  uuid, text, bigint, uuid, jsonb, date, uuid, text, text
) to authenticated;
grant execute on function public.dismiss_expense_draft(uuid, text)
to authenticated;
grant execute on function public.post_refund(
  uuid, bigint, jsonb, date, text, text, text
) to authenticated;
grant execute on function public.record_settlement(
  uuid, uuid, bigint, date, text, text, text
) to authenticated;
grant execute on function public.correct_financial_event(uuid, text, jsonb)
to authenticated;
grant execute on function public.create_recurring_expense_rule(
  uuid, text, bigint, uuid, jsonb, text, date, text, integer, integer, uuid
) to authenticated;
grant execute on function public.set_recurring_expense_rule_active(
  uuid, boolean, text
) to authenticated;
grant execute on function public.generate_due_recurring_drafts(uuid, date, text)
to authenticated;
