create or replace function public.cancel_shopping_session(p_shopping_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session public.shopping_sessions%rowtype;
  released_count integer;
begin
  select * into session from public.shopping_sessions
  where id = p_shopping_session_id for update;
  if not found then
    raise exception 'shopping session not found' using errcode = 'P0002';
  end if;
  if auth.uid() is null or auth.uid() <> session.member_id
    or not private.is_household_member(session.household_id) then
    raise exception 'caller cannot cancel this shopping session' using errcode = '42501';
  end if;
  if session.finished_at is not null then
    return jsonb_build_object('shopping_session_id', session.id, 'released_item_count', 0);
  end if;
  update public.grocery_items
    set state = 'active', claimed_by_session_id = null
    where household_id = session.household_id
      and state = 'claimed' and claimed_by_session_id = session.id;
  get diagnostics released_count = row_count;
  delete from public.shopping_session_items
    where household_id = session.household_id
      and shopping_session_id = session.id and purchased_at is null;
  update public.shopping_sessions set finished_at = now() where id = session.id;
  return jsonb_build_object('shopping_session_id', session.id, 'released_item_count', released_count);
end;
$$;
revoke all on function public.cancel_shopping_session(uuid) from public, anon;
grant execute on function public.cancel_shopping_session(uuid) to authenticated;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'grocery_categories') then
    alter publication supabase_realtime add table public.grocery_categories;
  end if;
end $$;
