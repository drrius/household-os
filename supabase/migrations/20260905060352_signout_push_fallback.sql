-- Discovery can fail in the browser. Keep signed-out notifications private even
-- when the current endpoint cannot be identified: pause only this member's push.
create function public.pause_my_push_for_signout()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  disabled integer;
  paused integer;
begin
  if actor is null or not exists(select 1 from public.household_members where user_id=actor)
  then raise exception 'Household membership required' using errcode='42501'; end if;
  update public.push_subscriptions s
    set disabled_at=now(), last_seen_at=now()
    where s.member_id=actor and s.disabled_at is null
      and private.is_household_member(s.household_id);
  get diagnostics disabled = row_count;
  select count(*)::integer into paused from public.push_subscriptions s
   where s.member_id=actor and s.disabled_at is not null
     and private.is_household_member(s.household_id);
  return jsonb_build_object('disabled',disabled,'paused',paused);
end;
$$;
revoke all on function public.pause_my_push_for_signout() from public,anon;
grant execute on function public.pause_my_push_for_signout() to authenticated;
