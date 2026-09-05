alter table public.meal_grocery_templates
  add column updated_at timestamptz not null default clock_timestamp();

create function private.advance_meal_template_version()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
revoke all on function private.advance_meal_template_version() from public, anon, authenticated;
create trigger advance_meal_template_version before update on public.meal_grocery_templates
for each row execute function private.advance_meal_template_version();
