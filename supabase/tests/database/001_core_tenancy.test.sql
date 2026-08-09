begin;

create extension if not exists pgtap with schema extensions;

select plan(34);

select has_table('public', 'households', 'households table exists');
select has_table('public', 'household_members', 'household_members table exists');
select has_function(
  'private',
  'is_household_member',
  array['uuid'],
  'membership helper exists outside the exposed schema'
);
select hasnt_function(
  'public',
  'is_household_member',
  array['uuid'],
  'the exposed schema has no privileged membership helper'
);
select ok(
  (
    select count(*) = 2 and bool_and(relrowsecurity)
    from pg_class
    where oid in ('public.households'::regclass, 'public.household_members'::regclass)
  ),
  'RLS is enabled on both tenant-owned foundation tables'
);
select policies_are(
  'public',
  'households',
  array['members can read their household', 'members can update their household'],
  'households exposes only member read and update policies'
);
select policies_are(
  'public',
  'household_members',
  array['members can read household membership'],
  'household membership exposes only member reads'
);
select col_type_is('public', 'households', 'timezone', 'text', 'timezone is text');
select col_type_is('public', 'households', 'currency', 'text', 'currency is text');
select col_is_pk(
  'public',
  'household_members',
  array['household_id', 'user_id'],
  'membership has a composite primary key'
);

select ok(
  has_table_privilege('authenticated', 'public.households', 'select'),
  'authenticated members may select households under RLS'
);
select ok(
  has_column_privilege('authenticated', 'public.households', 'name', 'update'),
  'authenticated members may update the household name under RLS'
);
select ok(
  not has_column_privilege('authenticated', 'public.households', 'reset_at', 'update'),
  'authenticated members cannot update the administrator-only reset marker'
);
select ok(
  not has_table_privilege('authenticated', 'public.households', 'insert'),
  'authenticated members cannot create households directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.households', 'delete'),
  'authenticated members cannot delete households'
);
select ok(
  has_table_privilege('authenticated', 'public.household_members', 'select'),
  'authenticated members may select household membership under RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.household_members', 'insert'),
  'authenticated members cannot add membership directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.household_members', 'update'),
  'authenticated members cannot change membership directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.household_members', 'delete'),
  'authenticated members cannot remove membership directly'
);
select ok(
  not has_table_privilege('anon', 'public.households', 'select'),
  'anonymous clients cannot read households'
);
select ok(
  not has_table_privilege('anon', 'public.household_members', 'select'),
  'anonymous clients cannot read membership'
);
select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'anonymous clients cannot resolve private helpers'
);
select ok(
  not has_function_privilege('anon', 'private.is_household_member(uuid)', 'execute'),
  'anonymous clients cannot execute the membership helper'
);
select ok(
  (
    select count(*) = 4
      and bool_and(privilege_type in ('DELETE', 'INSERT', 'SELECT', 'UPDATE'))
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name = 'households'
      and grantee = 'service_role'
  ),
  'trusted administration has only CRUD privileges on households'
);
select ok(
  not has_table_privilege('service_role', 'public.households', 'maintain'),
  'trusted administration cannot maintain households outside application commands'
);
select ok(
  (
    select count(*) = 4
      and bool_and(privilege_type in ('DELETE', 'INSERT', 'SELECT', 'UPDATE'))
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name = 'household_members'
      and grantee = 'service_role'
  ),
  'trusted administration has only CRUD privileges on household membership'
);
select ok(
  not has_table_privilege('service_role', 'public.household_members', 'maintain'),
  'trusted administration cannot maintain membership outside application commands'
);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000001', 'member-one@example.invalid'),
  ('00000000-0000-4000-8000-000000000002', 'member-two@example.invalid'),
  ('00000000-0000-4000-8000-000000000003', 'other-one@example.invalid'),
  ('00000000-0000-4000-8000-000000000004', 'other-two@example.invalid'),
  ('00000000-0000-4000-8000-000000000005', 'outsider@example.invalid');

insert into public.households (id, name)
values
  ('10000000-0000-4000-8000-000000000001', 'First household'),
  ('10000000-0000-4000-8000-000000000002', 'Second household');

insert into public.household_members (household_id, user_id, display_name)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'Member One'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    'Member Two'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
    'Other One'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000004',
    'Other Two'
  );

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select results_eq(
  $$ select id from public.households order by id $$,
  $$ values ('10000000-0000-4000-8000-000000000001'::uuid) $$,
  'a member reads only their household'
);
select results_eq(
  $$ select user_id from public.household_members order by user_id $$,
  $$
    values
      ('00000000-0000-4000-8000-000000000001'::uuid),
      ('00000000-0000-4000-8000-000000000002'::uuid)
  $$,
  'a member reads only their household membership'
);
select results_eq(
  $$
    update public.households
    set name = 'Updated first household'
    where id = '10000000-0000-4000-8000-000000000001'
    returning name
  $$,
  $$ values ('Updated first household'::text) $$,
  'a member can update their own household name'
);
select is_empty(
  $$
    update public.households
    set name = 'Blocked cross-household update'
    where id = '10000000-0000-4000-8000-000000000002'
    returning id
  $$,
  'RLS blocks cross-household updates'
);
select results_eq(
  $$
    select private.is_household_member(household_id)
    from (
      values
        ('10000000-0000-4000-8000-000000000001'::uuid),
        ('10000000-0000-4000-8000-000000000002'::uuid)
    ) as households(household_id)
    order by household_id
  $$,
  $$ values (true), (false) $$,
  'the private helper binds its answer to the authenticated caller'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000005',
  true
);
set local role authenticated;

select is_empty(
  $$ select id from public.households $$,
  'an authenticated nonmember reads no households'
);
select is_empty(
  $$ select household_id from public.household_members $$,
  'an authenticated nonmember reads no membership'
);

reset role;

select * from finish();
rollback;
