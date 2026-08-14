begin;

create extension if not exists pgtap with schema extensions;

select plan(1);

select ok(
  not exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    cross join (
      values ('anon'), ('authenticated'), ('public')
    ) as exposed_role(role_name)
    where namespace.nspname = 'public'
      and procedure.proname = 'rls_auto_enable'
      and has_function_privilege(
        exposed_role.role_name,
        procedure.oid,
        'execute'
      )
  ),
  'the automatic RLS helper is not executable through exposed roles'
);

select * from finish();

rollback;
