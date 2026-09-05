-- Validate separately from the transaction adding the lifecycle constraint.
alter table public.shopping_sessions
  validate constraint shopping_sessions_cancelled_finish_check;

-- A renamed pre-release default has no reliable identity to promote. Create a
-- persistent fallback without changing any existing category or item assignment.
insert into public.grocery_categories (household_id, name, sort_order, is_fallback)
select h.id, 'Other', 2147483647, true
from public.households h
where not exists (
  select 1 from public.grocery_categories c
  where c.household_id = h.id and c.is_fallback
);
