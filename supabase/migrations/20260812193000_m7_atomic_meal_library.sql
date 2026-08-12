alter table public.meal_grocery_command_receipts
  drop constraint meal_grocery_command_receipts_command_kind_check;

alter table public.meal_grocery_command_receipts
  add constraint meal_grocery_command_receipts_command_kind_check check (
    command_kind in (
      'place_meal',
      'create_and_place_meal',
      'move_meal_plan_entry',
      'remove_meal_plan_entry',
      'create_meal_preparation',
      'merge_grocery_items',
      'finish_shopping_session'
    )
  );

create or replace function public.create_and_place_meal(
  p_household_id uuid,
  p_name text,
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
  request_payload jsonb;
  prior_result jsonb;
  placement_result jsonb;
  result jsonb;
  new_definition_id uuid;
  internal_key text;
begin
  if actor_member_id is null
    or not private.is_household_member(p_household_id)
  then
    raise exception 'caller is not a member of household %', p_household_id
      using errcode = '42501';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120 then
    raise exception 'meal name must contain 1 to 120 characters'
      using errcode = '22023';
  end if;
  if p_recipe_url is not null and length(p_recipe_url) > 2000 then
    raise exception 'recipe URL must contain at most 2000 characters'
      using errcode = '22023';
  end if;
  if p_notes is not null and length(p_notes) > 4000 then
    raise exception 'meal notes must contain at most 4000 characters'
      using errcode = '22023';
  end if;

  request_payload := jsonb_build_object(
    'household_id', p_household_id,
    'name', trim(p_name),
    'date', p_date,
    'slot', p_slot,
    'recipe_url', p_recipe_url,
    'notes', p_notes
  );
  prior_result := private.get_meal_grocery_command_result(
    p_household_id,
    p_idempotency_key,
    'create_and_place_meal',
    request_payload
  );
  if prior_result is not null then
    return prior_result;
  end if;

  insert into public.meal_definitions (
    household_id,
    name,
    recipe_url,
    notes
  )
  values (
    p_household_id,
    trim(p_name),
    p_recipe_url,
    p_notes
  )
  returning id into new_definition_id;

  internal_key := 'm7-place:' || md5(
    p_household_id::text || ':' || p_idempotency_key
  );
  placement_result := public.place_meal(
    p_household_id => p_household_id,
    p_date => p_date,
    p_slot => p_slot,
    p_source_kind => 'library',
    p_idempotency_key => internal_key,
    p_meal_definition_id => new_definition_id
  );
  result := placement_result || jsonb_build_object(
    'meal_definition_id', new_definition_id
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
    'create_and_place_meal',
    request_payload,
    result
  );

  return result;
end;
$$;

revoke all on function public.create_and_place_meal(
  uuid,
  text,
  date,
  text,
  text,
  text,
  text
) from public, anon;

grant execute on function public.create_and_place_meal(
  uuid,
  text,
  date,
  text,
  text,
  text,
  text
) to authenticated;
