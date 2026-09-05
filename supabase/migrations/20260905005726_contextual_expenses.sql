-- One transaction owns the expense, its context, and its durable retry receipt.
-- No client may forge a contextual receipt for an existing manual expense.
create table private.contextual_expense_receipts (
  household_id uuid not null references public.households(id) on delete cascade,
  idempotency_key text not null check (length(trim(idempotency_key)) between 1 and 200),
  request_payload jsonb not null check (jsonb_typeof(request_payload) = 'object'),
  event_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (household_id, idempotency_key),
  unique (household_id, event_id),
  foreign key (household_id, event_id) references public.financial_events(household_id, id)
);
alter table private.contextual_expense_receipts enable row level security;
revoke all on private.contextual_expense_receipts from public, anon, authenticated, service_role;

create function public.post_contextual_expense(
  p_household_id uuid,
  p_description text,
  p_amount_cents bigint,
  p_payer_member_id uuid,
  p_allocations jsonb,
  p_occurred_on date,
  p_idempotency_key text,
  p_context_kind text,
  p_context_id uuid,
  p_category_id uuid default null,
  p_note text default null,
  p_receipt_path text default null,
  p_booking_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  allocations jsonb;
  payload jsonb;
  receipt private.contextual_expense_receipts%rowtype;
  target_archived timestamptz;
  posted jsonb;
  new_event_id uuid;
begin
  actor := private.require_money_actor(p_household_id);
  if p_context_kind is null or p_context_kind not in ('project','asset','commitment')
    or p_context_id is null or (p_booking_id is not null and p_context_kind <> 'project')
  then raise exception 'Choose a valid expense context' using errcode = '22023'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) not between 1 and 200
  then raise exception 'Idempotency key must contain 1 to 200 characters' using errcode = '22023'; end if;
  if p_receipt_path is not null and p_receipt_path !~ ('^' || p_household_id::text || '/receipts/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$')
  then raise exception 'Choose a receipt belonging to this household' using errcode = '22023'; end if;
  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array'
  then raise exception 'Allocations must be an array' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(item order by item->>'memberId', item::text), '[]'::jsonb)
    into allocations from jsonb_array_elements(p_allocations) as rows(item);
  payload := jsonb_build_object(
    'household_id',p_household_id,'description',trim(p_description),
    'amount_cents',p_amount_cents,'payer_member_id',p_payer_member_id,
    'allocations',allocations,'occurred_on',p_occurred_on,
    'category_id',p_category_id,'note',p_note,'receipt_path',p_receipt_path,
    'context_kind',p_context_kind,'context_id',p_context_id,'booking_id',p_booking_id
  );

  -- Same lock and key as every existing money command, acquired before parents.
  -- Manual-first: reject its receipt. Context-first: post_manual_expense reenters
  -- this transaction's lock; a waiter sees both receipts and the link together.
  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text || ':' || p_idempotency_key, 0));
  select * into receipt from private.contextual_expense_receipts
    where household_id=p_household_id and idempotency_key=p_idempotency_key;
  if found then
    if receipt.request_payload is distinct from payload
    then raise exception 'Idempotency key was already used for different expense details or context' using errcode = '22023'; end if;
    -- A replay acknowledges the original event. Never restore or reassign a link
    -- that either partner intentionally changed after the original posting.
    return jsonb_build_object('event_id',receipt.event_id);
  end if;
  if exists(select 1 from public.money_command_receipts
    where household_id=p_household_id and idempotency_key=p_idempotency_key)
  then raise exception 'Idempotency key was already used by another money command' using errcode = '22023'; end if;

  case p_context_kind
    when 'project' then
      select archived_at into target_archived from public.household_projects
        where household_id=p_household_id and id=p_context_id for update;
    when 'asset' then
      select archived_at into target_archived from public.household_assets
        where household_id=p_household_id and id=p_context_id for update;
    when 'commitment' then
      select archived_at into target_archived from public.household_commitments
        where household_id=p_household_id and id=p_context_id for update;
  end case;
  if not found then raise exception 'Expense context unavailable' using errcode = '42501'; end if;
  if target_archived is not null
  then raise exception 'Reopen the archived context before adding an expense' using errcode = '22023'; end if;
  if p_booking_id is not null then
    select archived_at into target_archived from public.trip_bookings
      where household_id=p_household_id and project_id=p_context_id and id=p_booking_id for update;
    if not found then raise exception 'Booking does not belong to this project' using errcode = '22023'; end if;
    if target_archived is not null
    then raise exception 'Reopen the archived booking before adding an expense' using errcode = '22023'; end if;
  end if;

  posted := public.post_manual_expense(
    p_household_id=>p_household_id,p_description=>trim(p_description),p_amount_cents=>p_amount_cents,
    p_payer_member_id=>p_payer_member_id,p_allocations=>allocations,
    p_occurred_on=>p_occurred_on,p_idempotency_key=>p_idempotency_key,
    p_category_id=>p_category_id,p_note=>p_note,p_receipt_path=>p_receipt_path
  );
  new_event_id := (posted->>'financial_event_id')::uuid;
  insert into public.household_financial_links(
    household_id,created_by,financial_event_id,project_id,asset_id,commitment_id,booking_id
  ) values (
    p_household_id,actor,new_event_id,
    case when p_context_kind='project' then p_context_id end,
    case when p_context_kind='asset' then p_context_id end,
    case when p_context_kind='commitment' then p_context_id end,p_booking_id
  );
  insert into private.contextual_expense_receipts(household_id,idempotency_key,request_payload,event_id)
    values(p_household_id,p_idempotency_key,payload,new_event_id);
  return jsonb_build_object('event_id',new_event_id);
end;
$$;
revoke all on function public.post_contextual_expense(uuid,text,bigint,uuid,jsonb,date,text,text,uuid,uuid,text,text,uuid)
  from public, anon;
grant execute on function public.post_contextual_expense(uuid,text,bigint,uuid,jsonb,date,text,text,uuid,uuid,text,text,uuid)
  to authenticated;
