-- The fallback category is an identity, independent of its editable name/order.
alter table public.grocery_categories add column is_fallback boolean not null default false;
create unique index grocery_categories_one_fallback on public.grocery_categories(household_id) where is_fallback;
-- Released v1 did not allow renaming categories. A later migration creates a
-- persistent fallback when a renamed pre-release default cannot be identified,
-- without guessing from editable positions or labels.
update public.grocery_categories set is_fallback=true where id in (
 select distinct on (household_id) id from public.grocery_categories
 where name='Other' order by household_id,(archived_at is null) desc,created_at,id
);
revoke insert on public.grocery_categories from authenticated;
grant insert(id,household_id,name,sort_order,archived_at,created_at) on public.grocery_categories to authenticated;
create or replace function private.seed_default_grocery_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.grocery_categories (household_id, name, sort_order, is_fallback)
  values
    (new.id, 'Produce', 1, false),
    (new.id, 'Bakery', 2, false),
    (new.id, 'Dairy & Eggs', 3, false),
    (new.id, 'Meat & Fish', 4, false),
    (new.id, 'Pantry', 5, false),
    (new.id, 'Frozen', 6, false),
    (new.id, 'Drinks', 7, false),
    (new.id, 'Household', 8, false),
    (new.id, 'Pet', 9, false),
    (new.id, 'Other', 10, true)
  on conflict (household_id, name) where archived_at is null do nothing;
  return new;
end;
$$;
