begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select has_table('public', 'households', 'households table exists');
select has_table('public', 'household_members', 'household_members table exists');
select has_function(
  'public',
  'is_household_member',
  array['uuid'],
  'membership helper exists'
);
select col_type_is('public', 'households', 'timezone', 'text', 'timezone is text');
select col_type_is('public', 'households', 'currency', 'text', 'currency is text');
select col_is_pk('public', 'household_members', array['household_id', 'user_id'], 'membership has a composite primary key');
select policies_are(
  'public',
  'households',
  array['members can read their household', 'members can update their household'],
  'households exposes only member read and update policies'
);

select * from finish();
rollback;
