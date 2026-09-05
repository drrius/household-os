-- Repeating an existing choice must not temporarily unchoose it or churn versions/activity.
create or replace function public.choose_household_decision_option(p_decision_id uuid, p_option_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_decision public.household_decisions%rowtype;
begin
  select * into v_decision from public.household_decisions where id = p_decision_id and private.is_household_member(household_id) for update;
  if not found then raise exception 'Decision not found' using errcode = '42501'; end if;
  if p_option_id is not null and not exists (
    select 1 from public.decision_options where id = p_option_id and decision_id = p_decision_id
      and household_id = v_decision.household_id and archived_at is null
  ) then raise exception 'Option not found' using errcode = '23514'; end if;
  update public.decision_options set chosen = false where decision_id = p_decision_id and chosen and id is distinct from p_option_id;
  update public.decision_options set chosen = true where id = p_option_id and not chosen;
  update public.household_decisions set status = case when p_option_id is null then 'considering' else 'decided' end
    where id = p_decision_id and status is distinct from case when p_option_id is null then 'considering' else 'decided' end;
end;
$$;
revoke all on function public.choose_household_decision_option(uuid, uuid) from public, anon;
grant execute on function public.choose_household_decision_option(uuid, uuid) to authenticated;
