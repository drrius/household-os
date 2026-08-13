alter table public.meal_grocery_command_receipts
  drop constraint meal_grocery_command_receipts_command_kind_check;

alter table public.meal_grocery_command_receipts
  add constraint meal_grocery_command_receipts_command_kind_check check (
    command_kind in (
      'place_meal',
      'create_and_place_meal',
      'move_meal_plan_entry',
      'update_meal_plan_entry',
      'remove_meal_plan_entry',
      'create_meal_preparation',
      'merge_grocery_items',
      'finish_shopping_session'
    )
  );

create or replace function public.update_meal_plan_entry(
  p_entry_id uuid,
  p_title text,
  p_date date,
  p_slot text,
  p_idempotency_key text,
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
  entry public.meal_plan_entries%rowtype;
  request_payload jsonb;
  prior_result jsonb;
  result jsonb;
  next_title text := nullif(btrim(p_title), '');
  next_recipe_url text := nullif(btrim(coalesce(p_recipe_url, '')), '');
  next_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  grocery_item_count integer := 0;
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
  if next_title is null or length(next_title) > 120 then
    raise exception 'meal title must be between 1 and 120 characters'
      using errcode = '22023';
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
  if next_recipe_url is not null and length(next_recipe_url) > 2000 then
    raise exception 'recipe URL must be at most 2000 characters'
      using errcode = '22023';
  end if;
  if next_notes is not null and length(next_notes) > 4000 then
    raise exception 'notes must be at most 4000 characters'
      using errcode = '22023';
  end if;

  request_payload := jsonb_build_object(
    'entry_id', p_entry_id,
    'title', next_title,
    'date', p_date,
    'slot', p_slot,
    'recipe_url', next_recipe_url,
    'notes', next_notes
  );
  prior_result := private.get_meal_grocery_command_result(
    entry.household_id,
    p_idempotency_key,
    'update_meal_plan_entry',
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
    raise exception 'removed meal-plan entries cannot be updated'
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

  if entry.title_snapshot is distinct from next_title
    or entry.recipe_url_snapshot is distinct from next_recipe_url
    or entry.notes is distinct from next_notes
    or entry.date is distinct from p_date
    or entry.slot is distinct from p_slot
  then
    update public.meal_plan_entries
    set title_snapshot = next_title,
        recipe_url_snapshot = next_recipe_url,
        notes = next_notes,
        date = p_date,
        slot = p_slot
    where id = entry.id;
    changed := true;

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
        'to_slot', p_slot,
        'title', next_title
      )
    );
  end if;

  result := jsonb_build_object(
    'meal_plan_entry_id', entry.id,
    'changed', changed,
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
    'update_meal_plan_entry',
    request_payload,
    result
  );

  return result;
end;
$$;

revoke all on function public.update_meal_plan_entry(
  uuid, text, date, text, text, text, text
) from public, anon;
grant execute on function public.update_meal_plan_entry(
  uuid, text, date, text, text, text, text
) to authenticated;
