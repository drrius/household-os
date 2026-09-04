begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

select has_table('public', 'grocery_categories', 'grocery categories table exists');
select has_table('public', 'meal_definitions', 'meal definitions table exists');
select has_table(
  'public',
  'meal_grocery_templates',
  'meal grocery templates table exists'
);
select has_table('public', 'meal_plan_entries', 'meal plan entries table exists');
select has_table('public', 'shopping_sessions', 'shopping sessions table exists');
select has_table('public', 'expense_drafts', 'expense drafts table exists');
select has_function(
  'public',
  'create_and_place_meal',
  'atomic library save and placement command exists'
);
select has_table('public', 'grocery_items', 'grocery items table exists');
select has_table(
  'public',
  'shopping_session_items',
  'shopping session items table exists'
);
select has_table(
  'public',
  'meal_grocery_command_receipts',
  'meal and grocery command receipts table exists'
);

select has_column(
  'public',
  'routine_occurrences',
  'meal_plan_entry_id',
  'routine occurrences can link meal preparation work'
);

select has_function('public', 'place_meal', 'place_meal exists');
select has_function(
  'public',
  'move_meal_plan_entry',
  'move_meal_plan_entry exists'
);
select has_function(
  'public',
  'remove_meal_plan_entry',
  'remove_meal_plan_entry exists'
);
select has_function(
  'public',
  'create_meal_preparation',
  'create_meal_preparation exists'
);
select has_function(
  'public',
  'start_shopping_session',
  'start_shopping_session exists'
);
select has_function(
  'public',
  'claim_grocery_item',
  'claim_grocery_item exists'
);
select has_function(
  'public',
  'release_grocery_item',
  'release_grocery_item exists'
);
select has_function(
  'public',
  'remove_grocery_item',
  'remove_grocery_item exists'
);
select has_function(
  'public',
  'merge_grocery_items',
  'merge_grocery_items exists'
);
select has_function(
  'public',
  'finish_shopping_session',
  'finish_shopping_session exists'
);

select ok(
  (
    select count(*) = 9 and bool_and(relrowsecurity)
    from pg_class
    where oid in (
      'public.grocery_categories'::regclass,
      'public.meal_definitions'::regclass,
      'public.meal_grocery_templates'::regclass,
      'public.meal_plan_entries'::regclass,
      'public.shopping_sessions'::regclass,
      'public.expense_drafts'::regclass,
      'public.grocery_items'::regclass,
      'public.shopping_session_items'::regclass,
      'public.meal_grocery_command_receipts'::regclass
    )
  ),
  'RLS is enabled on every meals and groceries table'
);

select ok(
  (
    select count(distinct tablename) = 9
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'grocery_categories',
        'meal_definitions',
        'meal_grocery_templates',
        'meal_plan_entries',
        'shopping_sessions',
        'expense_drafts',
        'grocery_items',
        'shopping_session_items',
        'meal_grocery_command_receipts'
      )
  ),
  'every meals and groceries table has an RLS policy'
);

select col_is_pk(
  'public',
  'meal_grocery_command_receipts',
  array['household_id', 'idempotency_key'],
  'command receipts serialize one result per household key'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.place_meal(uuid,date,text,text,text,uuid,uuid,text,text,text)',
    'execute'
  ),
  'anonymous clients cannot place meals'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.finish_shopping_session(uuid,text,date,bigint,text,boolean,text,bigint,uuid,jsonb)',
    'execute'
  ),
  'authenticated clients can execute the finish-shopping command'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.shopping_session_items',
    'insert'
  ),
  'authenticated clients cannot insert shopping session items directly'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.expense_drafts',
    'insert'
  ),
  'authenticated clients cannot insert expense drafts directly'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.grocery_items',
    'state',
    'update'
  ),
  'authenticated clients cannot update grocery state directly'
);

select ok(
  has_column_privilege(
    'authenticated',
    'public.grocery_items',
    'name',
    'update'
  ),
  'authenticated clients can update grocery descriptions'
);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000021', 'meal-member-one@example.invalid'),
  ('00000000-0000-4000-8000-000000000022', 'meal-member-two@example.invalid'),
  ('00000000-0000-4000-8000-000000000023', 'meal-other-one@example.invalid'),
  ('00000000-0000-4000-8000-000000000024', 'meal-other-two@example.invalid'),
  ('00000000-0000-4000-8000-000000000025', 'meal-outsider@example.invalid');

insert into public.households (id, name)
values
  ('10000000-0000-4000-8000-000000000021', 'Meals household one'),
  ('10000000-0000-4000-8000-000000000022', 'Meals household two');

insert into public.household_members (household_id, user_id, display_name)
values
  (
    '10000000-0000-4000-8000-000000000021',
    '00000000-0000-4000-8000-000000000021',
    'Meal Member One'
  ),
  (
    '10000000-0000-4000-8000-000000000021',
    '00000000-0000-4000-8000-000000000022',
    'Meal Member Two'
  ),
  (
    '10000000-0000-4000-8000-000000000022',
    '00000000-0000-4000-8000-000000000023',
    'Meal Other One'
  ),
  (
    '10000000-0000-4000-8000-000000000022',
    '00000000-0000-4000-8000-000000000024',
    'Meal Other Two'
  );

select is(
  (
    select count(*)::integer
    from public.grocery_categories
    where household_id = '10000000-0000-4000-8000-000000000021'
  ),
  10,
  'a new household receives ten default grocery categories'
);

select results_eq(
  $$
    select name, sort_order
    from public.grocery_categories
    where household_id = '10000000-0000-4000-8000-000000000021'
    order by sort_order
  $$,
  $$
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
  $$,
  'default grocery categories have the product-defined order'
);

insert into public.meal_definitions (
  id,
  household_id,
  name,
  recipe_url,
  notes
)
values (
  '20000000-0000-4000-8000-000000000021',
  '10000000-0000-4000-8000-000000000021',
  'Pasta bake',
  'https://example.invalid/pasta',
  'Family recipe'
);

insert into public.meal_grocery_templates (
  id,
  household_id,
  meal_definition_id,
  name,
  quantity,
  unit,
  grocery_category_id,
  sort_order
)
values
  (
    '30000000-0000-4000-8000-000000000021',
    '10000000-0000-4000-8000-000000000021',
    '20000000-0000-4000-8000-000000000021',
    'Pasta',
    '500',
    'g',
    (
      select id
      from public.grocery_categories
      where household_id = '10000000-0000-4000-8000-000000000021'
        and name = 'Pantry'
    ),
    1
  ),
  (
    '30000000-0000-4000-8000-000000000022',
    '10000000-0000-4000-8000-000000000021',
    '20000000-0000-4000-8000-000000000021',
    'Cheese',
    '200',
    'g',
    (
      select id
      from public.grocery_categories
      where household_id = '10000000-0000-4000-8000-000000000021'
        and name = 'Dairy & Eggs'
    ),
    2
  );

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000021',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*)::integer from public.grocery_categories),
  10,
  'members read only their household grocery categories'
);

select lives_ok(
  $$
    select public.create_and_place_meal(
      p_household_id => '10000000-0000-4000-8000-000000000021'::uuid,
      p_name => 'Atomic soup',
      p_date => '2030-08-07'::date,
      p_slot => 'lunch',
      p_idempotency_key => 'create-place-library-1',
      p_recipe_url => 'https://example.invalid/soup',
      p_notes => 'One transaction'
    )
  $$,
  'a member can atomically save and place a library meal'
);

select lives_ok(
  $$
    select public.create_and_place_meal(
      p_household_id => '10000000-0000-4000-8000-000000000021'::uuid,
      p_name => 'Atomic soup',
      p_date => '2030-08-07'::date,
      p_slot => 'lunch',
      p_idempotency_key => 'create-place-library-1',
      p_recipe_url => 'https://example.invalid/soup',
      p_notes => 'One transaction'
    )
  $$,
  'a same-key save-and-place retry returns the stored result'
);

select is(
  (
    select count(*)::integer
    from public.meal_definitions
    where household_id = '10000000-0000-4000-8000-000000000021'
      and name = 'Atomic soup'
  ),
  1,
  'the save-and-place retry creates one library definition'
);

select is(
  (
    select count(*)::integer
    from public.meal_plan_entries
    where household_id = '10000000-0000-4000-8000-000000000021'
      and date = '2030-08-07'
      and slot = 'lunch'
      and title_snapshot = 'Atomic soup'
  ),
  1,
  'the save-and-place retry creates one weekly slot entry'
);

select throws_ok(
  $$
    select public.create_and_place_meal(
      p_household_id => '10000000-0000-4000-8000-000000000022'::uuid,
      p_name => 'Denied soup',
      p_date => '2030-08-07'::date,
      p_slot => 'dinner',
      p_idempotency_key => 'cross-household-create-place'
    )
  $$,
  '42501',
  'caller is not a member of household 10000000-0000-4000-8000-000000000022',
  'the composite meal command rejects cross-household callers'
);

select lives_ok(
  $$
    select public.place_meal(
      p_household_id => '10000000-0000-4000-8000-000000000021'::uuid,
      p_date => '2030-08-06'::date,
      p_slot => 'dinner',
      p_source_kind => 'library',
      p_idempotency_key => 'place-library-1',
      p_meal_definition_id => '20000000-0000-4000-8000-000000000021'::uuid
    )
  $$,
  'a member can place a library meal'
);

select is(
  (
    select count(*)::integer
    from public.grocery_items
    where originating_meal_plan_entry_id = (
      select id
      from public.meal_plan_entries
      where title_snapshot = 'Pasta bake'
        and date = '2030-08-06'
    )
  ),
  2,
  'library placement materializes every template grocery'
);

select results_eq(
  $$
    select title_snapshot, recipe_url_snapshot, notes
    from public.meal_plan_entries
    where date = '2030-08-06' and slot = 'dinner'
  $$,
  $$
    values (
      'Pasta bake'::text,
      'https://example.invalid/pasta'::text,
      'Family recipe'::text
    )
  $$,
  'library placement snapshots the meal definition'
);

select lives_ok(
  $$
    select public.place_meal(
      p_household_id => '10000000-0000-4000-8000-000000000021'::uuid,
      p_date => '2030-08-07'::date,
      p_slot => 'dinner',
      p_source_kind => 'leftover',
      p_idempotency_key => 'place-leftover-1',
      p_leftover_of_entry_id => (
        select id
        from public.meal_plan_entries
        where date = '2030-08-06' and slot = 'dinner'
      )
    )
  $$,
  'a member can place a leftover from an earlier meal'
);

select is(
  (
    select count(*)::integer
    from public.grocery_items
    where originating_meal_plan_entry_id = (
      select id
      from public.meal_plan_entries
      where date = '2030-08-07' and slot = 'dinner'
    )
  ),
  0,
  'leftover placement never materializes groceries'
);

select lives_ok(
  $$
    select public.place_meal(
      p_household_id => '10000000-0000-4000-8000-000000000021'::uuid,
      p_date => '2030-08-05'::date,
      p_slot => null,
      p_source_kind => 'library',
      p_idempotency_key => 'place-idea-1',
      p_meal_definition_id => '20000000-0000-4000-8000-000000000021'::uuid,
      p_title => 'Pasta idea'
    )
  $$,
  'a member can place a library meal as a Monday idea'
);

select is(
  (
    select count(*)::integer
    from public.grocery_items
    where originating_meal_plan_entry_id = (
      select id
      from public.meal_plan_entries
      where title_snapshot = 'Pasta idea'
    )
  ),
  0,
  'ideas do not materialize groceries'
);

select lives_ok(
  $$
    select public.move_meal_plan_entry(
      p_entry_id => (
        select id
        from public.meal_plan_entries
        where title_snapshot = 'Pasta idea'
      ),
      p_date => '2030-08-08'::date,
      p_slot => 'lunch',
      p_idempotency_key => 'promote-idea-1'
    )
  $$,
  'moving an idea into a meal slot succeeds'
);

select is(
  (
    select count(*)::integer
    from public.grocery_items
    where originating_meal_plan_entry_id = (
      select id
      from public.meal_plan_entries
      where title_snapshot = 'Pasta idea'
    )
  ),
  2,
  'promoting a library idea materializes groceries once'
);

select lives_ok(
  $$
    select public.move_meal_plan_entry(
      p_entry_id => (
        select id
        from public.meal_plan_entries
        where title_snapshot = 'Pasta idea'
      ),
      p_date => '2030-08-09'::date,
      p_slot => 'breakfast',
      p_idempotency_key => 'move-promoted-idea-1'
    )
  $$,
  'a promoted meal can move again'
);

select is(
  (
    select count(*)::integer
    from public.grocery_items
    where originating_meal_plan_entry_id = (
      select id
      from public.meal_plan_entries
      where title_snapshot = 'Pasta idea'
    )
  ),
  2,
  'later moves do not rematerialize groceries'
);

select throws_ok(
  $$
    select public.place_meal(
      p_household_id => '10000000-0000-4000-8000-000000000022'::uuid,
      p_date => '2030-08-06'::date,
      p_slot => 'lunch',
      p_source_kind => 'freeform',
      p_idempotency_key => 'cross-household-place',
      p_title => 'Denied meal'
    )
  $$,
  '42501',
  'caller is not a member of household 10000000-0000-4000-8000-000000000022',
  'the meal command boundary rejects cross-household callers'
);

select lives_ok(
  $$
    insert into public.grocery_items (
      household_id,
      name,
      quantity,
      sort_order
    )
    values (
      '10000000-0000-4000-8000-000000000021',
      'Shared bananas',
      '6',
      20
    )
  $$,
  'a member can insert an active grocery item'
);

select lives_ok(
  $$
    select public.start_shopping_session(
      '10000000-0000-4000-8000-000000000021'
    )
  $$,
  'the first member can start a shopping session'
);

select lives_ok(
  $$
    select public.claim_grocery_item(
      (
        select id
        from public.shopping_sessions
        where member_id = '00000000-0000-4000-8000-000000000021'
          and finished_at is null
      ),
      (
        select id
        from public.grocery_items
        where name = 'Shared bananas'
      )
    )
  $$,
  'the first shopping session can claim an active item'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000022',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.start_shopping_session(
      '10000000-0000-4000-8000-000000000021'
    )
  $$,
  'the second member can start a concurrent shopping session'
);

select throws_ok(
  $$
    select public.claim_grocery_item(
      (
        select id
        from public.shopping_sessions
        where member_id = '00000000-0000-4000-8000-000000000022'
          and finished_at is null
      ),
      (
        select id
        from public.grocery_items
        where name = 'Shared bananas'
      )
    )
  $$,
  '55000',
  'grocery item is claimed by another active session',
  'a concurrent shopping session cannot claim the same item'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000021',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.reserve_household_attachment(
  '10000000-0000-4000-8000-000000000021/receipts/20000000-0000-4000-8000-000000000021.jpg', 'image/jpeg');
insert into storage.objects(bucket_id, name, metadata) values (
  'household-files', '10000000-0000-4000-8000-000000000021/receipts/20000000-0000-4000-8000-000000000021.jpg', '{"mimetype":"image/jpeg"}'::jsonb);

select lives_ok(
  $$
    select public.finish_shopping_session(
      p_shopping_session_id => (
        select id
        from public.shopping_sessions
        where member_id = '00000000-0000-4000-8000-000000000021'
          and finished_at is null
      ),
      p_idempotency_key => 'finish-shopping-1',
      p_occurred_on => '2030-08-09'::date,
      p_receipt_total_cents => 5000,
      p_receipt_path => '10000000-0000-4000-8000-000000000021/receipts/20000000-0000-4000-8000-000000000021.jpg',
      p_create_expense_draft => true,
      p_expense_description => 'Weekly groceries',
      p_shared_amount_cents => 3200,
      p_payer_member_id => '00000000-0000-4000-8000-000000000021'::uuid,
      p_proposed_allocations => '[
        {"memberId":"00000000-0000-4000-8000-000000000021","allocatedCents":1600},
        {"memberId":"00000000-0000-4000-8000-000000000022","allocatedCents":1600}
      ]'::jsonb
    )
  $$,
  'finishing shopping purchases claimed items and creates a draft'
);

select is(
  (
    select count(*)::integer
    from public.expense_drafts
    where shopping_session_id = (
      select id
      from public.shopping_sessions
      where member_id = '00000000-0000-4000-8000-000000000021'
        and finished_at is not null
    )
  ),
  1,
  'finishing shopping creates one expense draft'
);

select results_eq(
  $$
    select receipt_total_cents, amount_cents
    from public.shopping_sessions as session
    join public.expense_drafts as draft
      on draft.id = session.draft_expense_id
    where session.member_id = '00000000-0000-4000-8000-000000000021'
  $$,
  $$
    values (5000::bigint, 3200::bigint)
  $$,
  'receipt total remains independent from the shared draft amount'
);

select lives_ok(
  $$
    select public.finish_shopping_session(
      p_shopping_session_id => (
        select id
        from public.shopping_sessions
        where member_id = '00000000-0000-4000-8000-000000000021'
          and finished_at is not null
      ),
      p_idempotency_key => 'finish-shopping-1',
      p_occurred_on => '2030-08-09'::date,
      p_receipt_total_cents => 5000,
      p_receipt_path => '10000000-0000-4000-8000-000000000021/receipts/20000000-0000-4000-8000-000000000021.jpg',
      p_create_expense_draft => true,
      p_expense_description => 'Weekly groceries',
      p_shared_amount_cents => 3200,
      p_payer_member_id => '00000000-0000-4000-8000-000000000021'::uuid,
      p_proposed_allocations => '[
        {"memberId":"00000000-0000-4000-8000-000000000021","allocatedCents":1600},
        {"memberId":"00000000-0000-4000-8000-000000000022","allocatedCents":1600}
      ]'::jsonb
    )
  $$,
  'a same-key finish retry returns the stored result'
);

select is(
  (
    select count(*)::integer
    from public.expense_drafts
    where source_kind = 'shopping'
      and household_id = '10000000-0000-4000-8000-000000000021'
  ),
  1,
  'a same-key finish retry creates at most one draft'
);

select is(
  (
    select state
    from public.grocery_items
    where name = 'Shared bananas'
  ),
  'purchased',
  'finishing shopping marks the claimed item purchased'
);

reset role;

insert into public.grocery_items (
  household_id,
  name,
  sort_order,
  state,
  purchased_at
)
values
  (
    '10000000-0000-4000-8000-000000000021',
    'Old purchase',
    30,
    'purchased',
    now() - interval '31 days'
  ),
  (
    '10000000-0000-4000-8000-000000000021',
    'Recent purchase',
    31,
    'purchased',
    now() - interval '29 days'
  );

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000021',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is_empty(
  $$
    select id
    from public.grocery_items
    where name = 'Old purchase'
  $$,
  'purchased groceries older than 30 days are hidden'
);

select is(
  (
    select count(*)::integer
    from public.grocery_items
    where name = 'Recent purchase'
  ),
  1,
  'purchased groceries remain visible for 30 days'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.meal_grocery_command_receipts
    where household_id = '10000000-0000-4000-8000-000000000021'
      and idempotency_key = 'finish-shopping-1'
  ),
  1,
  'same-key finish retries create one command receipt'
);

select is(
  (
    select count(*)::integer
    from public.activity_events
    where household_id = '10000000-0000-4000-8000-000000000021'
      and kind = 'shopping_session_finished'
  ),
  1,
  'finishing shopping writes one activity event'
);

reset role;

insert into public.grocery_items (
  household_id,
  name,
  sort_order
)
values (
  '10000000-0000-4000-8000-000000000021',
  'Retry remove item',
  40
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000021',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.remove_grocery_item(
      (
        select id
        from public.grocery_items
        where name = 'Retry remove item'
      )
    )
  $$,
  'a member can remove an active grocery item'
);

select lives_ok(
  $$
    select public.remove_grocery_item(
      (
        select id
        from public.grocery_items
        where name = 'Retry remove item'
      )
    )
  $$,
  'removing an already removed grocery item is idempotent'
);

select is(
  (
    select (public.remove_grocery_item(id) ->> 'changed')::boolean
    from public.grocery_items
    where name = 'Retry remove item'
  ),
  false,
  'a removal retry reports unchanged success'
);

select lives_ok(
  $$
    select public.create_meal_preparation(
      p_meal_plan_entry_id => (
        select id
        from public.meal_plan_entries
        where date = '2030-08-06' and slot = 'dinner'
      ),
      p_title => 'Defrost pasta sauce',
      p_instructions => null,
      p_due_on => '2030-08-05'::date,
      p_area_id => (
        select id
        from public.areas
        where household_id = '10000000-0000-4000-8000-000000000021'
          and name = 'Meals'
      ),
      p_assignment_policy => 'shared',
      p_assigned_member_id => null,
      p_rotation_anchor_member_id => null,
      p_idempotency_key => 'prep-lock-1'
    )
  $$,
  'a member can create preparation work for an active meal'
);

select lives_ok(
  $$
    select public.remove_meal_plan_entry(
      p_entry_id => (
        select id
        from public.meal_plan_entries
        where date = '2030-08-06' and slot = 'dinner'
      ),
      p_idempotency_key => 'remove-meal-with-prep'
    )
  $$,
  'removing a meal skips its linked preparation occurrence'
);

select throws_ok(
  $$
    select public.create_meal_preparation(
      p_meal_plan_entry_id => (
        select id
        from public.meal_plan_entries
        where date = '2030-08-06' and slot = 'dinner'
      ),
      p_title => 'Too late',
      p_instructions => null,
      p_due_on => '2030-08-05'::date,
      p_area_id => (
        select id
        from public.areas
        where household_id = '10000000-0000-4000-8000-000000000021'
          and name = 'Meals'
      ),
      p_assignment_policy => 'shared',
      p_assigned_member_id => null,
      p_rotation_anchor_member_id => null,
      p_idempotency_key => 'prep-after-remove'
    )
  $$,
  '55000',
  'removed meal-plan entries cannot receive preparation work',
  'preparation cannot attach to a removed meal-plan entry'
);

select is(
  (
    select occurrence.status
    from public.routine_occurrences as occurrence
    where occurrence.meal_plan_entry_id = (
      select id
      from public.meal_plan_entries
      where date = '2030-08-06' and slot = 'dinner'
    )
  ),
  'skipped',
  'meal removal skips the locked preparation occurrence'
);

select lives_ok(
  $$
    select public.place_meal(
      p_household_id => '10000000-0000-4000-8000-000000000021'::uuid,
      p_date => '2030-08-08'::date,
      p_slot => 'lunch',
      p_source_kind => 'freeform',
      p_idempotency_key => 'place-freeform-edit-source',
      p_title => 'Editable lunch',
      p_recipe_url => 'https://example.invalid/old',
      p_notes => 'Old notes'
    )
  $$,
  'a member can place a freeform meal to edit'
);

select lives_ok(
  $$
    select public.update_meal_plan_entry(
      p_entry_id => (
        select id
        from public.meal_plan_entries
        where date = '2030-08-08' and slot = 'lunch'
      ),
      p_title => 'Edited lunch',
      p_date => '2030-08-08'::date,
      p_slot => 'dinner',
      p_idempotency_key => 'update-meal-1',
      p_recipe_url => 'https://example.invalid/new',
      p_notes => 'New notes'
    )
  $$,
  'a member can update a planned meal'
);

select results_eq(
  $$
    select title_snapshot, recipe_url_snapshot, notes, slot
    from public.meal_plan_entries
    where date = '2030-08-08' and removed_at is null
  $$,
  $$
    values (
      'Edited lunch'::text,
      'https://example.invalid/new'::text,
      'New notes'::text,
      'dinner'::text
    )
  $$,
  'meal update rewrites title, recipe, notes, and slot'
);

select lives_ok(
  $$
    select public.update_meal_plan_entry(
      p_entry_id => (
        select id
        from public.meal_plan_entries
        where date = '2030-08-08' and slot = 'dinner'
      ),
      p_title => 'Edited lunch',
      p_date => '2030-08-08'::date,
      p_slot => 'dinner',
      p_idempotency_key => 'update-meal-1',
      p_recipe_url => 'https://example.invalid/new',
      p_notes => 'New notes'
    )
  $$,
  'meal update replays the same idempotency key'
);

select * from finish();
rollback;
