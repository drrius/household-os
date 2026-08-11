create table public.grocery_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  sort_order integer not null check (sort_order >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, id)
);

create unique index grocery_categories_active_name_idx
  on public.grocery_categories (household_id, name)
  where archived_at is null;

create table public.meal_definitions (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  recipe_url text check (recipe_url is null or length(recipe_url) <= 2000),
  notes text check (notes is null or length(notes) <= 4000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id)
);

create table public.meal_grocery_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  meal_definition_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 120),
  quantity text check (quantity is null or length(quantity) <= 80),
  unit text check (unit is null or length(unit) <= 80),
  grocery_category_id uuid,
  note text check (note is null or length(note) <= 1000),
  sort_order integer not null check (sort_order >= 0),
  unique (household_id, id),
  foreign key (household_id, meal_definition_id)
    references public.meal_definitions(household_id, id) on delete cascade,
  foreign key (household_id, grocery_category_id)
    references public.grocery_categories(household_id, id)
);

create table public.meal_plan_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  date date not null,
  slot text check (slot in ('breakfast', 'lunch', 'dinner')),
  meal_definition_id uuid,
  title_snapshot text not null check (length(trim(title_snapshot)) between 1 and 120),
  recipe_url_snapshot text
    check (recipe_url_snapshot is null or length(recipe_url_snapshot) <= 2000),
  notes text check (notes is null or length(notes) <= 4000),
  leftover_of_entry_id uuid,
  groceries_materialized_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, meal_definition_id)
    references public.meal_definitions(household_id, id),
  foreign key (household_id, leftover_of_entry_id)
    references public.meal_plan_entries(household_id, id),
  check (slot is not null or extract(isodow from date) = 1),
  check (leftover_of_entry_id is null or leftover_of_entry_id <> id)
);

create unique index meal_plan_entries_active_slot_idx
  on public.meal_plan_entries (household_id, date, slot)
  where slot is not null and removed_at is null;

create table public.shopping_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  receipt_total_cents bigint
    check (
      receipt_total_cents is null
      or receipt_total_cents between 0 and 9007199254740991
    ),
  receipt_path text,
  draft_expense_id uuid,
  unique (household_id, id),
  foreign key (household_id, member_id)
    references public.household_members(household_id, user_id)
);

create unique index shopping_sessions_one_active_member_idx
  on public.shopping_sessions (household_id, member_id)
  where finished_at is null;

create table public.expense_drafts (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source_kind text not null check (source_kind in ('shopping', 'recurring')),
  shopping_session_id uuid unique,
  description text not null check (length(trim(description)) between 1 and 200),
  amount_cents bigint
    check (
      amount_cents is null
      or amount_cents between 0 and 9007199254740991
    ),
  payer_member_id uuid,
  proposed_allocations jsonb not null default '[]'::jsonb
    check (jsonb_typeof(proposed_allocations) = 'array'),
  occurred_on date not null,
  status text not null default 'pending'
    check (status in ('pending', 'posted', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, shopping_session_id)
    references public.shopping_sessions(household_id, id),
  foreign key (household_id, payer_member_id)
    references public.household_members(household_id, user_id),
  check (
    (source_kind = 'shopping' and shopping_session_id is not null)
    or (source_kind = 'recurring' and shopping_session_id is null)
  )
);

alter table public.shopping_sessions
  add foreign key (household_id, draft_expense_id)
  references public.expense_drafts(household_id, id);

create table public.grocery_items (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  quantity text check (quantity is null or length(quantity) <= 80),
  unit text check (unit is null or length(unit) <= 80),
  category_id uuid,
  note text check (note is null or length(note) <= 1000),
  originating_meal_plan_entry_id uuid,
  sort_order integer not null check (sort_order >= 0),
  state text not null default 'active'
    check (state in ('active', 'claimed', 'purchased', 'removed')),
  claimed_by_session_id uuid,
  purchased_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, category_id)
    references public.grocery_categories(household_id, id),
  foreign key (household_id, originating_meal_plan_entry_id)
    references public.meal_plan_entries(household_id, id),
  foreign key (household_id, claimed_by_session_id)
    references public.shopping_sessions(household_id, id),
  check (
    (
      state = 'active'
      and claimed_by_session_id is null
      and purchased_at is null
      and removed_at is null
    )
    or (
      state = 'claimed'
      and claimed_by_session_id is not null
      and purchased_at is null
      and removed_at is null
    )
    or (
      state = 'purchased'
      and claimed_by_session_id is null
      and purchased_at is not null
      and removed_at is null
    )
    or (
      state = 'removed'
      and claimed_by_session_id is null
      and purchased_at is null
      and removed_at is not null
    )
  )
);

create index grocery_items_active_order_idx
  on public.grocery_items (household_id, category_id, sort_order, created_at)
  where state in ('active', 'claimed');

create index grocery_items_recent_purchased_idx
  on public.grocery_items (household_id, purchased_at desc)
  where state = 'purchased';

create table public.shopping_session_items (
  household_id uuid not null references public.households(id) on delete cascade,
  shopping_session_id uuid not null,
  grocery_item_id uuid not null unique,
  claimed_at timestamptz not null default now(),
  purchased_at timestamptz,
  primary key (shopping_session_id, grocery_item_id),
  foreign key (household_id, shopping_session_id)
    references public.shopping_sessions(household_id, id),
  foreign key (household_id, grocery_item_id)
    references public.grocery_items(household_id, id),
  check (purchased_at is null or purchased_at >= claimed_at)
);

create table public.meal_grocery_command_receipts (
  household_id uuid not null references public.households(id) on delete cascade,
  idempotency_key text not null check (length(trim(idempotency_key)) between 1 and 200),
  command_kind text not null check (
    command_kind in (
      'place_meal',
      'move_meal_plan_entry',
      'remove_meal_plan_entry',
      'create_meal_preparation',
      'merge_grocery_items',
      'finish_shopping_session'
    )
  ),
  request_payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (household_id, idempotency_key)
);

alter table public.routine_occurrences
  add column meal_plan_entry_id uuid;

alter table public.routine_occurrences
  add foreign key (household_id, meal_plan_entry_id)
  references public.meal_plan_entries(household_id, id);

create unique index routine_occurrences_meal_plan_entry_idx
  on public.routine_occurrences (meal_plan_entry_id)
  where meal_plan_entry_id is not null;

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
      'shopping_session_finished'
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
      'shopping_session'
    )
  );

create or replace function private.set_meals_groceries_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger meal_definitions_set_updated_at
before update on public.meal_definitions
for each row
execute function private.set_meals_groceries_updated_at();

create trigger meal_plan_entries_set_updated_at
before update on public.meal_plan_entries
for each row
execute function private.set_meals_groceries_updated_at();

create trigger expense_drafts_set_updated_at
before update on public.expense_drafts
for each row
execute function private.set_meals_groceries_updated_at();

create trigger grocery_items_set_updated_at
before update on public.grocery_items
for each row
execute function private.set_meals_groceries_updated_at();

create or replace function private.validate_leftover_meal_plan_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  source_entry public.meal_plan_entries%rowtype;
begin
  if new.leftover_of_entry_id is null then
    return new;
  end if;

  select entry.*
  into source_entry
  from public.meal_plan_entries as entry
  where entry.household_id = new.household_id
    and entry.id = new.leftover_of_entry_id;

  if not found then
    raise exception 'leftover source does not belong to the household'
      using errcode = '23503';
  end if;
  if source_entry.removed_at is not null then
    raise exception 'leftover source has been removed'
      using errcode = '23514';
  end if;
  if source_entry.leftover_of_entry_id is not null then
    raise exception 'a leftover cannot reference another leftover'
      using errcode = '23514';
  end if;
  if source_entry.date >= new.date then
    raise exception 'leftover source must be earlier than the target entry'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger meal_plan_entries_validate_leftover
before insert or update of household_id, date, leftover_of_entry_id
on public.meal_plan_entries
for each row
execute function private.validate_leftover_meal_plan_entry();

create or replace function private.seed_default_grocery_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.grocery_categories (household_id, name, sort_order)
  values
    (new.id, 'Produce', 1),
    (new.id, 'Bakery', 2),
    (new.id, 'Dairy & Eggs', 3),
    (new.id, 'Meat & Fish', 4),
    (new.id, 'Pantry', 5),
    (new.id, 'Frozen', 6),
    (new.id, 'Drinks', 7),
    (new.id, 'Household', 8),
    (new.id, 'Pet', 9),
    (new.id, 'Other', 10)
  on conflict (household_id, name) where archived_at is null do nothing;
  return new;
end;
$$;

create trigger households_seed_default_grocery_categories
after insert on public.households
for each row
execute function private.seed_default_grocery_categories();

insert into public.grocery_categories (household_id, name, sort_order)
select household.id, defaults.name, defaults.sort_order
from public.households as household
cross join (
  values
    ('Produce'::text, 1),
    ('Bakery'::text, 2),
    ('Dairy & Eggs'::text, 3),
    ('Meat & Fish'::text, 4),
    ('Pantry'::text, 5),
    ('Frozen'::text, 6),
    ('Drinks'::text, 7),
    ('Household'::text, 8),
    ('Pet'::text, 9),
    ('Other'::text, 10)
) as defaults(name, sort_order)
on conflict (household_id, name) where archived_at is null do nothing;

create or replace function private.materialize_meal_groceries(
  p_meal_plan_entry_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry public.meal_plan_entries%rowtype;
  created_count integer;
begin
  select stored_entry.*
  into entry
  from public.meal_plan_entries as stored_entry
  where stored_entry.id = p_meal_plan_entry_id
  for update;

  if not found then
    raise exception 'meal-plan entry % does not exist', p_meal_plan_entry_id
      using errcode = 'P0002';
  end if;
  if entry.slot is null
    or entry.meal_definition_id is null
    or entry.leftover_of_entry_id is not null
    or entry.groceries_materialized_at is not null
  then
    return 0;
  end if;

  insert into public.grocery_items (
    household_id,
    name,
    quantity,
    unit,
    category_id,
    note,
    originating_meal_plan_entry_id,
    sort_order
  )
  select
    template.household_id,
    template.name,
    template.quantity,
    template.unit,
    template.grocery_category_id,
    template.note,
    entry.id,
    template.sort_order
  from public.meal_grocery_templates as template
  where template.household_id = entry.household_id
    and template.meal_definition_id = entry.meal_definition_id
  order by template.sort_order, template.id;

  get diagnostics created_count = row_count;

  update public.meal_plan_entries
  set groceries_materialized_at = now()
  where id = entry.id;

  return created_count;
end;
$$;

create or replace function private.get_meal_grocery_command_result(
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
  receipt public.meal_grocery_command_receipts%rowtype;
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
  from public.meal_grocery_command_receipts as stored_receipt
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

create or replace function public.place_meal(
  p_household_id uuid,
  p_date date,
  p_slot text,
  p_source_kind text,
  p_idempotency_key text,
  p_meal_definition_id uuid default null,
  p_leftover_of_entry_id uuid default null,
  p_title text default null,
  p_recipe_url text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  request_payload jsonb;
  prior_result jsonb;
  result jsonb;
  definition public.meal_definitions%rowtype;
  source_entry public.meal_plan_entries%rowtype;
  new_entry_id uuid;
  snapshot_definition_id uuid;
  snapshot_title text;
  snapshot_recipe_url text;
  snapshot_notes text;
  snapshot_leftover_id uuid;
  grocery_item_count integer := 0;
begin
  if actor_member_id is null
    or not private.is_household_member(p_household_id)
  then
    raise exception 'caller is not a member of household %', p_household_id
      using errcode = '42501';
  end if;
  if p_date is null then
    raise exception 'meal date is required' using errcode = '22023';
  end if;
  if p_slot is not null
    and p_slot not in ('breakfast', 'lunch', 'dinner')
  then
    raise exception 'unknown meal slot %', p_slot using errcode = '22023';
  end if;
  if p_slot is null and extract(isodow from p_date) <> 1 then
    raise exception 'meal ideas must use the Monday week date'
      using errcode = '22023';
  end if;
  if p_source_kind not in ('library', 'freeform', 'leftover') then
    raise exception 'unknown meal source kind %', p_source_kind
      using errcode = '22023';
  end if;

  request_payload := jsonb_build_object(
    'household_id', p_household_id,
    'date', p_date,
    'slot', p_slot,
    'source_kind', p_source_kind,
    'meal_definition_id', p_meal_definition_id,
    'leftover_of_entry_id', p_leftover_of_entry_id,
    'title', p_title,
    'recipe_url', p_recipe_url,
    'notes', p_notes
  );
  prior_result := private.get_meal_grocery_command_result(
    p_household_id,
    p_idempotency_key,
    'place_meal',
    request_payload
  );
  if prior_result is not null then
    return prior_result;
  end if;

  case p_source_kind
    when 'library' then
      if p_meal_definition_id is null or p_leftover_of_entry_id is not null then
        raise exception 'library meals require only a meal definition'
          using errcode = '22023';
      end if;

      select stored_definition.*
      into definition
      from public.meal_definitions as stored_definition
      where stored_definition.household_id = p_household_id
        and stored_definition.id = p_meal_definition_id;

      if not found then
        raise exception 'meal definition % does not belong to the household',
          p_meal_definition_id
          using errcode = '42501';
      end if;
      if definition.archived_at is not null then
        raise exception 'archived meal definitions cannot be placed'
          using errcode = '55000';
      end if;

      snapshot_definition_id := definition.id;
      snapshot_title := coalesce(nullif(trim(p_title), ''), definition.name);
      snapshot_recipe_url := definition.recipe_url;
      snapshot_notes := coalesce(p_notes, definition.notes);
      snapshot_leftover_id := null;
    when 'freeform' then
      if p_meal_definition_id is not null or p_leftover_of_entry_id is not null then
        raise exception 'freeform meals cannot name a library or leftover source'
          using errcode = '22023';
      end if;
      if p_title is null or length(trim(p_title)) not between 1 and 120 then
        raise exception 'freeform meals require a title'
          using errcode = '22023';
      end if;

      snapshot_definition_id := null;
      snapshot_title := trim(p_title);
      snapshot_recipe_url := p_recipe_url;
      snapshot_notes := p_notes;
      snapshot_leftover_id := null;
    when 'leftover' then
      if p_leftover_of_entry_id is null or p_meal_definition_id is not null then
        raise exception 'leftovers require only a source meal-plan entry'
          using errcode = '22023';
      end if;

      select stored_entry.*
      into source_entry
      from public.meal_plan_entries as stored_entry
      where stored_entry.household_id = p_household_id
        and stored_entry.id = p_leftover_of_entry_id;

      if not found then
        raise exception 'leftover source % does not belong to the household',
          p_leftover_of_entry_id
          using errcode = '42501';
      end if;
      if source_entry.removed_at is not null then
        raise exception 'leftover source has been removed'
          using errcode = '55000';
      end if;
      if source_entry.leftover_of_entry_id is not null then
        raise exception 'a leftover cannot reference another leftover'
          using errcode = '22023';
      end if;
      if source_entry.date >= p_date then
        raise exception 'leftover source must be earlier than the target entry'
          using errcode = '22023';
      end if;

      snapshot_definition_id := source_entry.meal_definition_id;
      snapshot_title := source_entry.title_snapshot;
      snapshot_recipe_url := source_entry.recipe_url_snapshot;
      snapshot_notes := coalesce(p_notes, source_entry.notes);
      snapshot_leftover_id := source_entry.id;
    else
      raise exception 'unknown meal source kind %', p_source_kind
        using errcode = '22023';
  end case;

  insert into public.meal_plan_entries (
    household_id,
    date,
    slot,
    meal_definition_id,
    title_snapshot,
    recipe_url_snapshot,
    notes,
    leftover_of_entry_id
  )
  values (
    p_household_id,
    p_date,
    p_slot,
    snapshot_definition_id,
    snapshot_title,
    snapshot_recipe_url,
    snapshot_notes,
    snapshot_leftover_id
  )
  returning id into new_entry_id;

  if p_source_kind = 'library' and p_slot is not null then
    grocery_item_count := private.materialize_meal_groceries(new_entry_id);
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
    p_household_id,
    actor_member_id,
    'meal_plan_entry_created',
    'meal_plan_entry',
    new_entry_id,
    jsonb_build_object(
      'date', p_date,
      'slot', p_slot,
      'source_kind', p_source_kind
    )
  );

  result := jsonb_build_object(
    'meal_plan_entry_id', new_entry_id,
    'grocery_item_count', grocery_item_count
  );

  insert into public.meal_grocery_command_receipts (
    household_id,
    idempotency_key,
    command_kind,
    request_payload,
    result
  )
  values (
    p_household_id,
    p_idempotency_key,
    'place_meal',
    request_payload,
    result
  );

  return result;
end;
$$;

create or replace function public.move_meal_plan_entry(
  p_entry_id uuid,
  p_date date,
  p_slot text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  entry public.meal_plan_entries%rowtype;
  request_payload jsonb;
  prior_result jsonb;
  result jsonb;
  grocery_item_count integer := 0;
begin
  select stored_entry.*
  into entry
  from public.meal_plan_entries as stored_entry
  where stored_entry.id = p_entry_id;

  if not found then
    raise exception 'meal-plan entry % does not exist', p_entry_id
      using errcode = 'P0002';
  end if;
  if actor_member_id is null
    or not private.is_household_member(entry.household_id)
  then
    raise exception 'caller is not a member of household %', entry.household_id
      using errcode = '42501';
  end if;
  if p_date is null then
    raise exception 'meal date is required' using errcode = '22023';
  end if;
  if p_slot is not null
    and p_slot not in ('breakfast', 'lunch', 'dinner')
  then
    raise exception 'unknown meal slot %', p_slot using errcode = '22023';
  end if;
  if p_slot is null and extract(isodow from p_date) <> 1 then
    raise exception 'meal ideas must use the Monday week date'
      using errcode = '22023';
  end if;

  request_payload := jsonb_build_object(
    'entry_id', p_entry_id,
    'date', p_date,
    'slot', p_slot
  );
  prior_result := private.get_meal_grocery_command_result(
    entry.household_id,
    p_idempotency_key,
    'move_meal_plan_entry',
    request_payload
  );
  if prior_result is not null then
    return prior_result;
  end if;

  select stored_entry.*
  into entry
  from public.meal_plan_entries as stored_entry
  where stored_entry.id = p_entry_id
  for update;

  if entry.removed_at is not null then
    raise exception 'removed meal-plan entries cannot be moved'
      using errcode = '55000';
  end if;
  if exists (
    select 1
    from public.meal_plan_entries as leftover
    where leftover.household_id = entry.household_id
      and leftover.leftover_of_entry_id = entry.id
      and leftover.removed_at is null
      and leftover.date <= p_date
  ) then
    raise exception 'move would place a leftover before its source'
      using errcode = '23514';
  end if;

  update public.meal_plan_entries
  set date = p_date,
      slot = p_slot
  where id = entry.id;

  if p_slot is not null
    and entry.meal_definition_id is not null
    and entry.leftover_of_entry_id is null
    and entry.groceries_materialized_at is null
  then
    grocery_item_count := private.materialize_meal_groceries(entry.id);
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
    entry.household_id,
    actor_member_id,
    'meal_plan_entry_updated',
    'meal_plan_entry',
    entry.id,
    jsonb_build_object(
      'from_date', entry.date,
      'from_slot', entry.slot,
      'to_date', p_date,
      'to_slot', p_slot
    )
  );

  result := jsonb_build_object(
    'meal_plan_entry_id', entry.id,
    'grocery_item_count', grocery_item_count
  );

  insert into public.meal_grocery_command_receipts (
    household_id,
    idempotency_key,
    command_kind,
    request_payload,
    result
  )
  values (
    entry.household_id,
    p_idempotency_key,
    'move_meal_plan_entry',
    request_payload,
    result
  );

  return result;
end;
$$;

create or replace function public.remove_meal_plan_entry(
  p_entry_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  entry public.meal_plan_entries%rowtype;
  request_payload jsonb;
  prior_result jsonb;
  result jsonb;
  preparation_occurrence_id uuid;
  changed boolean := false;
begin
  select stored_entry.*
  into entry
  from public.meal_plan_entries as stored_entry
  where stored_entry.id = p_entry_id;

  if not found then
    raise exception 'meal-plan entry % does not exist', p_entry_id
      using errcode = 'P0002';
  end if;
  if actor_member_id is null
    or not private.is_household_member(entry.household_id)
  then
    raise exception 'caller is not a member of household %', entry.household_id
      using errcode = '42501';
  end if;

  request_payload := jsonb_build_object('entry_id', p_entry_id);
  prior_result := private.get_meal_grocery_command_result(
    entry.household_id,
    p_idempotency_key,
    'remove_meal_plan_entry',
    request_payload
  );
  if prior_result is not null then
    return prior_result;
  end if;

  select stored_entry.*
  into entry
  from public.meal_plan_entries as stored_entry
  where stored_entry.id = p_entry_id
  for update;

  if entry.removed_at is null then
    update public.meal_plan_entries
    set removed_at = now()
    where id = entry.id;
    changed := true;

    select occurrence.id
    into preparation_occurrence_id
    from public.routine_occurrences as occurrence
    where occurrence.meal_plan_entry_id = entry.id
      and occurrence.status = 'open'
      and occurrence.role = 'current'
    for update;

    if found then
      perform private.apply_routine_closure(
        preparation_occurrence_id,
        'meal-plan-remove:' || entry.id::text,
        'skip',
        null,
        null,
        null,
        null
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
      entry.household_id,
      actor_member_id,
      'meal_plan_entry_removed',
      'meal_plan_entry',
      entry.id,
      jsonb_build_object('date', entry.date, 'slot', entry.slot)
    );
  end if;

  result := jsonb_build_object(
    'meal_plan_entry_id', entry.id,
    'removed', true,
    'changed', changed
  );

  insert into public.meal_grocery_command_receipts (
    household_id,
    idempotency_key,
    command_kind,
    request_payload,
    result
  )
  values (
    entry.household_id,
    p_idempotency_key,
    'remove_meal_plan_entry',
    request_payload,
    result
  );

  return result;
end;
$$;

create or replace function public.create_meal_preparation(
  p_meal_plan_entry_id uuid,
  p_title text,
  p_instructions text,
  p_due_on date,
  p_area_id uuid,
  p_assignment_policy text,
  p_assigned_member_id uuid,
  p_rotation_anchor_member_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  entry public.meal_plan_entries%rowtype;
  request_payload jsonb;
  prior_result jsonb;
  routine_result jsonb;
  result jsonb;
  routine_id uuid;
  occurrence_id uuid;
begin
  select stored_entry.*
  into entry
  from public.meal_plan_entries as stored_entry
  where stored_entry.id = p_meal_plan_entry_id;

  if not found then
    raise exception 'meal-plan entry % does not exist', p_meal_plan_entry_id
      using errcode = 'P0002';
  end if;
  if actor_member_id is null
    or not private.is_household_member(entry.household_id)
  then
    raise exception 'caller is not a member of household %', entry.household_id
      using errcode = '42501';
  end if;

  request_payload := jsonb_build_object(
    'meal_plan_entry_id', p_meal_plan_entry_id,
    'title', p_title,
    'instructions', p_instructions,
    'due_on', p_due_on,
    'area_id', p_area_id,
    'assignment_policy', p_assignment_policy,
    'assigned_member_id', p_assigned_member_id,
    'rotation_anchor_member_id', p_rotation_anchor_member_id
  );
  prior_result := private.get_meal_grocery_command_result(
    entry.household_id,
    p_idempotency_key,
    'create_meal_preparation',
    request_payload
  );
  if prior_result is not null then
    return prior_result;
  end if;

  select stored_entry.*
  into entry
  from public.meal_plan_entries as stored_entry
  where stored_entry.id = p_meal_plan_entry_id
  for update;

  if entry.removed_at is not null then
    raise exception 'removed meal-plan entries cannot receive preparation work'
      using errcode = '55000';
  end if;
  if exists (
    select 1
    from public.routine_occurrences as occurrence
    where occurrence.meal_plan_entry_id = entry.id
  ) then
    raise exception 'meal-plan entry already has preparation work'
      using errcode = '23505';
  end if;

  routine_result := public.create_routine(
    p_household_id => entry.household_id,
    p_title => p_title,
    p_area_id => p_area_id,
    p_assignment_policy => p_assignment_policy,
    p_schedule_kind => 'one_off',
    p_schedule_rule => jsonb_build_object('kind', 'one_off', 'date', p_due_on),
    p_assigned_member_id => p_assigned_member_id,
    p_rotation_anchor_member_id => p_rotation_anchor_member_id,
    p_instructions => p_instructions,
    p_priority => 'meal_deadline',
    p_active_from => p_due_on,
    p_active_until => p_due_on
  );

  routine_id := (routine_result ->> 'routine_id')::uuid;
  occurrence_id := (routine_result ->> 'current_occurrence_id')::uuid;

  update public.routine_occurrences
  set meal_plan_entry_id = entry.id
  where id = occurrence_id;

  result := jsonb_build_object(
    'meal_plan_entry_id', entry.id,
    'routine_id', routine_id,
    'occurrence_id', occurrence_id
  );

  insert into public.meal_grocery_command_receipts (
    household_id,
    idempotency_key,
    command_kind,
    request_payload,
    result
  )
  values (
    entry.household_id,
    p_idempotency_key,
    'create_meal_preparation',
    request_payload,
    result
  );

  return result;
end;
$$;

create or replace function public.start_shopping_session(
  p_household_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  session_id uuid;
begin
  if actor_member_id is null
    or not private.is_household_member(p_household_id)
  then
    raise exception 'caller is not a member of household %', p_household_id
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'shopping-session:' || p_household_id::text || ':' || actor_member_id::text,
      0
    )
  );

  select session.id
  into session_id
  from public.shopping_sessions as session
  where session.household_id = p_household_id
    and session.member_id = actor_member_id
    and session.finished_at is null
  for update;

  if found then
    return jsonb_build_object(
      'shopping_session_id', session_id,
      'existing', true
    );
  end if;

  insert into public.shopping_sessions (household_id, member_id)
  values (p_household_id, actor_member_id)
  returning id into session_id;

  return jsonb_build_object(
    'shopping_session_id', session_id,
    'existing', false
  );
end;
$$;

create or replace function public.claim_grocery_item(
  p_shopping_session_id uuid,
  p_grocery_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  session public.shopping_sessions%rowtype;
  item public.grocery_items%rowtype;
  changed boolean := false;
begin
  select stored_session.*
  into session
  from public.shopping_sessions as stored_session
  where stored_session.id = p_shopping_session_id
  for update;

  if not found then
    raise exception 'shopping session % does not exist', p_shopping_session_id
      using errcode = 'P0002';
  end if;
  if actor_member_id is null
    or session.member_id <> actor_member_id
    or not private.is_household_member(session.household_id)
  then
    raise exception 'caller cannot use shopping session %', session.id
      using errcode = '42501';
  end if;
  if session.finished_at is not null then
    raise exception 'finished shopping sessions cannot claim items'
      using errcode = '55000';
  end if;

  select stored_item.*
  into item
  from public.grocery_items as stored_item
  where stored_item.id = p_grocery_item_id
  for update;

  if not found then
    raise exception 'grocery item % does not exist', p_grocery_item_id
      using errcode = 'P0002';
  end if;
  if item.household_id <> session.household_id then
    raise exception 'grocery item does not belong to the shopping session household'
      using errcode = '42501';
  end if;

  case item.state
    when 'active' then
      update public.grocery_items
      set state = 'claimed',
          claimed_by_session_id = session.id
      where id = item.id;
      changed := true;
    when 'claimed' then
      if item.claimed_by_session_id <> session.id then
        raise exception 'grocery item is claimed by another active session'
          using errcode = '55000';
      end if;
    when 'purchased', 'removed' then
      raise exception 'terminal grocery items cannot be claimed'
        using errcode = '55000';
    else
      raise exception 'unknown grocery item state %', item.state
        using errcode = '23514';
  end case;

  insert into public.shopping_session_items (
    household_id,
    shopping_session_id,
    grocery_item_id
  )
  values (
    session.household_id,
    session.id,
    item.id
  )
  on conflict (shopping_session_id, grocery_item_id) do nothing;

  return jsonb_build_object(
    'shopping_session_id', session.id,
    'grocery_item_id', item.id,
    'state', 'claimed',
    'changed', changed
  );
end;
$$;

create or replace function public.release_grocery_item(
  p_shopping_session_id uuid,
  p_grocery_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  session public.shopping_sessions%rowtype;
  item public.grocery_items%rowtype;
  changed boolean := false;
begin
  select stored_session.*
  into session
  from public.shopping_sessions as stored_session
  where stored_session.id = p_shopping_session_id
  for update;

  if not found then
    raise exception 'shopping session % does not exist', p_shopping_session_id
      using errcode = 'P0002';
  end if;
  if actor_member_id is null
    or session.member_id <> actor_member_id
    or not private.is_household_member(session.household_id)
  then
    raise exception 'caller cannot use shopping session %', session.id
      using errcode = '42501';
  end if;
  if session.finished_at is not null then
    raise exception 'finished shopping sessions cannot release items'
      using errcode = '55000';
  end if;

  select stored_item.*
  into item
  from public.grocery_items as stored_item
  where stored_item.id = p_grocery_item_id
  for update;

  if not found then
    raise exception 'grocery item % does not exist', p_grocery_item_id
      using errcode = 'P0002';
  end if;
  if item.household_id <> session.household_id then
    raise exception 'grocery item does not belong to the shopping session household'
      using errcode = '42501';
  end if;

  case item.state
    when 'active' then
      changed := false;
    when 'claimed' then
      if item.claimed_by_session_id <> session.id then
        raise exception 'grocery item is not claimed by this session'
          using errcode = '55000';
      end if;
      update public.grocery_items
      set state = 'active',
          claimed_by_session_id = null
      where id = item.id;
      delete from public.shopping_session_items
      where shopping_session_id = session.id
        and grocery_item_id = item.id;
      changed := true;
    when 'purchased', 'removed' then
      raise exception 'terminal grocery items cannot be released'
        using errcode = '55000';
    else
      raise exception 'unknown grocery item state %', item.state
        using errcode = '23514';
  end case;

  return jsonb_build_object(
    'shopping_session_id', session.id,
    'grocery_item_id', item.id,
    'state', 'active',
    'changed', changed
  );
end;
$$;

create or replace function public.remove_grocery_item(
  p_grocery_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  item public.grocery_items%rowtype;
begin
  select stored_item.*
  into item
  from public.grocery_items as stored_item
  where stored_item.id = p_grocery_item_id
  for update;

  if not found then
    raise exception 'grocery item % does not exist', p_grocery_item_id
      using errcode = 'P0002';
  end if;
  if actor_member_id is null
    or not private.is_household_member(item.household_id)
  then
    raise exception 'caller is not a member of household %', item.household_id
      using errcode = '42501';
  end if;
  if item.state = 'removed' then
    return jsonb_build_object(
      'grocery_item_id', item.id,
      'state', 'removed',
      'changed', false
    );
  end if;
  if item.state <> 'active' then
    raise exception 'only active grocery items can be removed'
      using errcode = '55000';
  end if;

  update public.grocery_items
  set state = 'removed',
      removed_at = now()
  where id = item.id;

  return jsonb_build_object(
    'grocery_item_id', item.id,
    'state', 'removed',
    'changed', true
  );
end;
$$;

create or replace function public.merge_grocery_items(
  p_keep_item_id uuid,
  p_remove_item_id uuid,
  p_name text,
  p_quantity text,
  p_unit text,
  p_category_id uuid,
  p_note text,
  p_sort_order integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_member_id uuid := auth.uid();
  keep_item public.grocery_items%rowtype;
  remove_item public.grocery_items%rowtype;
  request_payload jsonb;
  prior_result jsonb;
  result jsonb;
begin
  if p_keep_item_id = p_remove_item_id then
    raise exception 'merge requires two distinct grocery items'
      using errcode = '22023';
  end if;

  select stored_item.*
  into keep_item
  from public.grocery_items as stored_item
  where stored_item.id = p_keep_item_id;

  if not found then
    raise exception 'grocery item % does not exist', p_keep_item_id
      using errcode = 'P0002';
  end if;
  if actor_member_id is null
    or not private.is_household_member(keep_item.household_id)
  then
    raise exception 'caller is not a member of household %', keep_item.household_id
      using errcode = '42501';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120 then
    raise exception 'merged grocery item requires a name'
      using errcode = '22023';
  end if;
  if p_sort_order is null or p_sort_order < 0 then
    raise exception 'merged grocery item requires a non-negative sort order'
      using errcode = '22023';
  end if;

  request_payload := jsonb_build_object(
    'keep_item_id', p_keep_item_id,
    'remove_item_id', p_remove_item_id,
    'name', p_name,
    'quantity', p_quantity,
    'unit', p_unit,
    'category_id', p_category_id,
    'note', p_note,
    'sort_order', p_sort_order
  );
  prior_result := private.get_meal_grocery_command_result(
    keep_item.household_id,
    p_idempotency_key,
    'merge_grocery_items',
    request_payload
  );
  if prior_result is not null then
    return prior_result;
  end if;

  perform 1
  from public.grocery_items as stored_item
  where stored_item.id in (p_keep_item_id, p_remove_item_id)
  order by stored_item.id
  for update;

  select stored_item.*
  into keep_item
  from public.grocery_items as stored_item
  where stored_item.id = p_keep_item_id;

  select stored_item.*
  into remove_item
  from public.grocery_items as stored_item
  where stored_item.id = p_remove_item_id;

  if not found then
    raise exception 'grocery item % does not exist', p_remove_item_id
      using errcode = 'P0002';
  end if;
  if remove_item.household_id <> keep_item.household_id then
    raise exception 'grocery items must belong to the same household'
      using errcode = '42501';
  end if;
  if keep_item.state <> 'active' or remove_item.state <> 'active' then
    raise exception 'only active grocery items can be merged'
      using errcode = '55000';
  end if;

  update public.grocery_items
  set name = trim(p_name),
      quantity = p_quantity,
      unit = p_unit,
      category_id = p_category_id,
      note = p_note,
      sort_order = p_sort_order
  where id = keep_item.id;

  update public.grocery_items
  set state = 'removed',
      removed_at = now()
  where id = remove_item.id;

  result := jsonb_build_object(
    'keep_item_id', keep_item.id,
    'removed_item_id', remove_item.id
  );

  insert into public.meal_grocery_command_receipts (
    household_id,
    idempotency_key,
    command_kind,
    request_payload,
    result
  )
  values (
    keep_item.household_id,
    p_idempotency_key,
    'merge_grocery_items',
    request_payload,
    result
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
    jsonb_build_object(
      'purchased_item_count', purchased_count,
      'expense_draft_id', draft_id
    )
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

alter table public.grocery_categories enable row level security;
alter table public.meal_definitions enable row level security;
alter table public.meal_grocery_templates enable row level security;
alter table public.meal_plan_entries enable row level security;
alter table public.shopping_sessions enable row level security;
alter table public.expense_drafts enable row level security;
alter table public.grocery_items enable row level security;
alter table public.shopping_session_items enable row level security;
alter table public.meal_grocery_command_receipts enable row level security;

create policy "members can read grocery categories"
on public.grocery_categories for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "members can create grocery categories"
on public.grocery_categories for insert to authenticated
with check ((select private.is_household_member(household_id)));

create policy "members can update grocery categories"
on public.grocery_categories for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));

create policy "members can read meal definitions"
on public.meal_definitions for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "members can create meal definitions"
on public.meal_definitions for insert to authenticated
with check ((select private.is_household_member(household_id)));

create policy "members can update meal definitions"
on public.meal_definitions for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));

create policy "members can read meal grocery templates"
on public.meal_grocery_templates for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "members can create meal grocery templates"
on public.meal_grocery_templates for insert to authenticated
with check ((select private.is_household_member(household_id)));

create policy "members can update meal grocery templates"
on public.meal_grocery_templates for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));

create policy "members can delete meal grocery templates"
on public.meal_grocery_templates for delete to authenticated
using ((select private.is_household_member(household_id)));

create policy "members can read meal plan entries"
on public.meal_plan_entries for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "members can read shopping sessions"
on public.shopping_sessions for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "members can read expense drafts"
on public.expense_drafts for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "members can read current grocery items"
on public.grocery_items for select to authenticated
using (
  (select private.is_household_member(household_id))
  and (
    state <> 'purchased'
    or purchased_at >= now() - interval '30 days'
  )
);

create policy "members can create active grocery items"
on public.grocery_items for insert to authenticated
with check (
  (select private.is_household_member(household_id))
  and state = 'active'
  and claimed_by_session_id is null
  and purchased_at is null
  and removed_at is null
);

create policy "members can update grocery descriptions"
on public.grocery_items for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));

create policy "members can read shopping session items"
on public.shopping_session_items for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "members can read meal grocery command receipts"
on public.meal_grocery_command_receipts for select to authenticated
using ((select private.is_household_member(household_id)));

revoke all on table public.grocery_categories from anon, authenticated;
revoke all on table public.meal_definitions from anon, authenticated;
revoke all on table public.meal_grocery_templates from anon, authenticated;
revoke all on table public.meal_plan_entries from anon, authenticated;
revoke all on table public.shopping_sessions from anon, authenticated;
revoke all on table public.expense_drafts from anon, authenticated;
revoke all on table public.grocery_items from anon, authenticated;
revoke all on table public.shopping_session_items from anon, authenticated;
revoke all on table public.meal_grocery_command_receipts from anon, authenticated;

grant select, insert on table public.grocery_categories to authenticated;
grant update (name, sort_order, archived_at)
  on table public.grocery_categories to authenticated;

grant select, insert on table public.meal_definitions to authenticated;
grant update (name, recipe_url, notes, archived_at)
  on table public.meal_definitions to authenticated;

grant select, insert, delete
  on table public.meal_grocery_templates to authenticated;
grant update (name, quantity, unit, grocery_category_id, note, sort_order)
  on table public.meal_grocery_templates to authenticated;

grant select on table public.meal_plan_entries to authenticated;
grant select on table public.shopping_sessions to authenticated;
grant select on table public.expense_drafts to authenticated;

grant select on table public.grocery_items to authenticated;
grant insert (
  household_id,
  name,
  quantity,
  unit,
  category_id,
  note,
  sort_order
) on public.grocery_items to authenticated;
grant update (name, quantity, unit, category_id, note, sort_order)
  on table public.grocery_items to authenticated;

grant select on table public.shopping_session_items to authenticated;
grant select on table public.meal_grocery_command_receipts to authenticated;

revoke all on table public.grocery_categories from service_role;
revoke all on table public.meal_definitions from service_role;
revoke all on table public.meal_grocery_templates from service_role;
revoke all on table public.meal_plan_entries from service_role;
revoke all on table public.shopping_sessions from service_role;
revoke all on table public.expense_drafts from service_role;
revoke all on table public.grocery_items from service_role;
revoke all on table public.shopping_session_items from service_role;
revoke all on table public.meal_grocery_command_receipts from service_role;

grant select, insert, update, delete
  on table public.grocery_categories to service_role;
grant select, insert, update, delete
  on table public.meal_definitions to service_role;
grant select, insert, update, delete
  on table public.meal_grocery_templates to service_role;
grant select, insert, update, delete
  on table public.meal_plan_entries to service_role;
grant select, insert, update, delete
  on table public.shopping_sessions to service_role;
grant select, insert, update, delete
  on table public.expense_drafts to service_role;
grant select, insert, update, delete
  on table public.grocery_items to service_role;
grant select, insert, update, delete
  on table public.shopping_session_items to service_role;
grant select, insert
  on table public.meal_grocery_command_receipts to service_role;

revoke all on function private.set_meals_groceries_updated_at()
from public, anon, authenticated;
revoke all on function private.validate_leftover_meal_plan_entry()
from public, anon, authenticated;
revoke all on function private.seed_default_grocery_categories()
from public, anon, authenticated;
revoke all on function private.materialize_meal_groceries(uuid)
from public, anon, authenticated;
revoke all on function private.get_meal_grocery_command_result(
  uuid, text, text, jsonb
) from public, anon, authenticated;

revoke execute on function public.place_meal(
  uuid, date, text, text, text, uuid, uuid, text, text, text
) from public, anon;
revoke execute on function public.move_meal_plan_entry(uuid, date, text, text)
from public, anon;
revoke execute on function public.remove_meal_plan_entry(uuid, text)
from public, anon;
revoke execute on function public.create_meal_preparation(
  uuid, text, text, date, uuid, text, uuid, uuid, text
) from public, anon;
revoke execute on function public.start_shopping_session(uuid)
from public, anon;
revoke execute on function public.claim_grocery_item(uuid, uuid)
from public, anon;
revoke execute on function public.release_grocery_item(uuid, uuid)
from public, anon;
revoke execute on function public.remove_grocery_item(uuid)
from public, anon;
revoke execute on function public.merge_grocery_items(
  uuid, uuid, text, text, text, uuid, text, integer, text
) from public, anon;
revoke execute on function public.finish_shopping_session(
  uuid, text, date, bigint, text, boolean, text, bigint, uuid, jsonb
) from public, anon;

grant execute on function public.place_meal(
  uuid, date, text, text, text, uuid, uuid, text, text, text
) to authenticated;
grant execute on function public.move_meal_plan_entry(uuid, date, text, text)
to authenticated;
grant execute on function public.remove_meal_plan_entry(uuid, text)
to authenticated;
grant execute on function public.create_meal_preparation(
  uuid, text, text, date, uuid, text, uuid, uuid, text
) to authenticated;
grant execute on function public.start_shopping_session(uuid)
to authenticated;
grant execute on function public.claim_grocery_item(uuid, uuid)
to authenticated;
grant execute on function public.release_grocery_item(uuid, uuid)
to authenticated;
grant execute on function public.remove_grocery_item(uuid)
to authenticated;
grant execute on function public.merge_grocery_items(
  uuid, uuid, text, text, text, uuid, text, integer, text
) to authenticated;
grant execute on function public.finish_shopping_session(
  uuid, text, date, bigint, text, boolean, text, bigint, uuid, jsonb
) to authenticated;
