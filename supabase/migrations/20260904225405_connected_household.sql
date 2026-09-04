-- Descriptive household records link to, but never rewrite, financial history.
create or replace function private.guard_household_record_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.household_id <> old.household_id
      or new.created_by <> old.created_by or new.created_at <> old.created_at then
      raise exception 'record identity cannot be changed' using errcode = '23514';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.guard_household_record_identity() from public, anon, authenticated;

create table public.household_projects (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, created_by) references public.household_members(household_id, user_id),
  kind text not null check (kind in ('project', 'trip')),
  title text not null check (length(trim(title)) between 1 and 160),
  description text not null default '' check (length(description) <= 8000),
  status text not null default 'planning' check (status in ('planning', 'active', 'complete', 'cancelled')),
  starts_on date,
  ends_on date,
  destination text not null default '' check (length(destination) <= 300),
  budget_cents bigint check (budget_cents between 0 and 9007199254740991),
  archived_at timestamptz,
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index household_projects_household_idx on public.household_projects(household_id);
alter table public.household_projects enable row level security;
revoke all on public.household_projects from public, anon, authenticated;
grant select, insert, update on public.household_projects to authenticated;
create policy household_projects_read on public.household_projects for select to authenticated
  using (private.is_household_member(household_id));
create policy household_projects_create on public.household_projects for insert to authenticated
  with check (private.is_household_member(household_id) and created_by = (select auth.uid()));
create policy household_projects_edit on public.household_projects for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
create trigger household_projects_identity before update on public.household_projects
  for each row execute function private.guard_household_record_identity();

create table public.household_contacts (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, created_by) references public.household_members(household_id, user_id),
  name text not null check (length(trim(name)) between 1 and 160),
  company text not null default '' check (length(company) <= 200),
  phone text not null default '' check (length(phone) <= 80),
  email text not null default '' check (length(email) <= 254),
  website text not null default '' check (length(website) <= 2000),
  notes text not null default '' check (length(notes) <= 4000),
  archived_at timestamptz
);
create index household_contacts_household_idx on public.household_contacts(household_id);
alter table public.household_contacts enable row level security;
revoke all on public.household_contacts from public, anon, authenticated;
grant select, insert, update on public.household_contacts to authenticated;
create policy household_contacts_read on public.household_contacts for select to authenticated
  using (private.is_household_member(household_id));
create policy household_contacts_create on public.household_contacts for insert to authenticated
  with check (private.is_household_member(household_id) and created_by = (select auth.uid()));
create policy household_contacts_edit on public.household_contacts for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
create trigger household_contacts_identity before update on public.household_contacts
  for each row execute function private.guard_household_record_identity();

create table public.household_assets (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, created_by) references public.household_members(household_id, user_id),
  title text not null check (length(trim(title)) between 1 and 160),
  category text not null default 'Home' check (length(category) <= 80),
  model text not null default '' check (length(model) <= 200),
  serial_number text not null default '' check (length(serial_number) <= 200),
  purchased_on date,
  warranty_until date,
  contact_id uuid,
  notes text not null default '' check (length(notes) <= 8000),
  archived_at timestamptz,
  foreign key (household_id, contact_id) references public.household_contacts(household_id, id),
  check (warranty_until is null or purchased_on is null or warranty_until >= purchased_on)
);
create index household_assets_household_idx on public.household_assets(household_id);
alter table public.household_assets enable row level security;
revoke all on public.household_assets from public, anon, authenticated;
grant select, insert, update on public.household_assets to authenticated;
create policy household_assets_read on public.household_assets for select to authenticated
  using (private.is_household_member(household_id));
create policy household_assets_create on public.household_assets for insert to authenticated
  with check (private.is_household_member(household_id) and created_by = (select auth.uid()));
create policy household_assets_edit on public.household_assets for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
create trigger household_assets_identity before update on public.household_assets
  for each row execute function private.guard_household_record_identity();

create table public.household_commitments (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, created_by) references public.household_members(household_id, user_id),
  title text not null check (length(trim(title)) between 1 and 160),
  provider text not null default '' check (length(provider) <= 200),
  status text not null default 'active' check (status in ('active', 'cancel_requested', 'ended')),
  responsible_member_id uuid,
  renewal_on date,
  notice_days integer not null default 0 check (notice_days between 0 and 730),
  expected_amount_cents bigint check (expected_amount_cents between 0 and 9007199254740991),
  billing_interval text not null default 'monthly' check (billing_interval in ('weekly', 'monthly', 'yearly', 'one_off')),
  recurring_expense_rule_id uuid,
  contact_id uuid,
  website text not null default '' check (length(website) <= 2000),
  notes text not null default '' check (length(notes) <= 8000),
  archived_at timestamptz,
  foreign key (household_id, responsible_member_id) references public.household_members(household_id, user_id),
  foreign key (household_id, recurring_expense_rule_id) references public.recurring_expense_rules(household_id, id),
  foreign key (household_id, contact_id) references public.household_contacts(household_id, id)
);
create index household_commitments_household_idx on public.household_commitments(household_id);
alter table public.household_commitments enable row level security;
revoke all on public.household_commitments from public, anon, authenticated;
grant select, insert, update on public.household_commitments to authenticated;
create policy household_commitments_read on public.household_commitments for select to authenticated
  using (private.is_household_member(household_id));
create policy household_commitments_create on public.household_commitments for insert to authenticated
  with check (private.is_household_member(household_id) and created_by = (select auth.uid()));
create policy household_commitments_edit on public.household_commitments for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
create trigger household_commitments_identity before update on public.household_commitments
  for each row execute function private.guard_household_record_identity();

create table public.project_tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, created_by) references public.household_members(household_id, user_id),
  project_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 200),
  section text not null default 'Tasks' check (length(section) between 1 and 80),
  assigned_member_id uuid,
  due_on date,
  completed_at timestamptz,
  completed_by_member_id uuid,
  sort_order integer not null default 0 check (sort_order >= 0),
  notes text not null default '' check (length(notes) <= 4000),
  archived_at timestamptz,
  foreign key (household_id, project_id) references public.household_projects(household_id, id),
  foreign key (household_id, assigned_member_id) references public.household_members(household_id, user_id),
  foreign key (household_id, completed_by_member_id) references public.household_members(household_id, user_id),
  check ((completed_at is null) = (completed_by_member_id is null))
);
create index project_tasks_household_idx on public.project_tasks(household_id);
alter table public.project_tasks enable row level security;
revoke all on public.project_tasks from public, anon, authenticated;
grant select, insert, update on public.project_tasks to authenticated;
create policy project_tasks_read on public.project_tasks for select to authenticated
  using (private.is_household_member(household_id));
create policy project_tasks_create on public.project_tasks for insert to authenticated
  with check (private.is_household_member(household_id) and created_by = (select auth.uid()));
create policy project_tasks_edit on public.project_tasks for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
create trigger project_tasks_identity before update on public.project_tasks
  for each row execute function private.guard_household_record_identity();

create table public.calendar_events (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, created_by) references public.household_members(household_id, user_id),
  title text not null check (length(trim(title)) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  time_zone text not null default 'Europe/Zurich' check (length(time_zone) between 1 and 100),
  all_day boolean not null default false,
  attendance text not null default 'both' check (attendance in ('both', 'one', 'fyi')),
  attending_member_id uuid,
  location text not null default '' check (length(location) <= 500),
  notes text not null default '' check (length(notes) <= 8000),
  project_id uuid,
  recurrence_rule text check (length(recurrence_rule) <= 1000),
  cancelled_at timestamptz,
  check (ends_at >= starts_at),
  check ((attendance = 'one') = (attending_member_id is not null)),
  foreign key (household_id, attending_member_id) references public.household_members(household_id, user_id),
  foreign key (household_id, project_id) references public.household_projects(household_id, id)
);
create index calendar_events_household_idx on public.calendar_events(household_id);
alter table public.calendar_events enable row level security;
revoke all on public.calendar_events from public, anon, authenticated;
grant select, insert, update on public.calendar_events to authenticated;
create policy calendar_events_read on public.calendar_events for select to authenticated
  using (private.is_household_member(household_id));
create policy calendar_events_create on public.calendar_events for insert to authenticated
  with check (private.is_household_member(household_id) and created_by = (select auth.uid()));
create policy calendar_events_edit on public.calendar_events for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
create trigger calendar_events_identity before update on public.calendar_events
  for each row execute function private.guard_household_record_identity();

create table public.trip_bookings (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, created_by) references public.household_members(household_id, user_id),
  project_id uuid not null,
  kind text not null check (kind in ('flight', 'stay', 'transport', 'activity', 'other')),
  title text not null check (length(trim(title)) between 1 and 200),
  status text not null default 'idea' check (status in ('idea', 'booked', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  time_zone text not null default 'Europe/Zurich' check (length(time_zone) between 1 and 100),
  end_time_zone text not null default 'Europe/Zurich' check (length(end_time_zone) between 1 and 100),
  origin text not null default '' check (length(origin) <= 500),
  destination text not null default '' check (length(destination) <= 500),
  confirmation text not null default '' check (length(confirmation) <= 300),
  website text not null default '' check (length(website) <= 2000),
  estimated_amount_cents bigint check (estimated_amount_cents between 0 and 9007199254740991),
  calendar_event_id uuid,
  notes text not null default '' check (length(notes) <= 8000),
  archived_at timestamptz,
  check (ends_at is null or starts_at is null or ends_at >= starts_at),
  foreign key (household_id, project_id) references public.household_projects(household_id, id),
  foreign key (household_id, calendar_event_id) references public.calendar_events(household_id, id)
);
create index trip_bookings_household_idx on public.trip_bookings(household_id);
alter table public.trip_bookings enable row level security;
revoke all on public.trip_bookings from public, anon, authenticated;
grant select, insert, update on public.trip_bookings to authenticated;
create policy trip_bookings_read on public.trip_bookings for select to authenticated
  using (private.is_household_member(household_id));
create policy trip_bookings_create on public.trip_bookings for insert to authenticated
  with check (private.is_household_member(household_id) and created_by = (select auth.uid()));
create policy trip_bookings_edit on public.trip_bookings for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
create trigger trip_bookings_identity before update on public.trip_bookings
  for each row execute function private.guard_household_record_identity();

create table public.household_decisions (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, created_by) references public.household_members(household_id, user_id),
  title text not null check (length(trim(title)) between 1 and 200),
  notes text not null default '' check (length(notes) <= 8000),
  status text not null default 'considering' check (status in ('considering', 'decided', 'dismissed')),
  project_id uuid,
  converted_project_id uuid,
  archived_at timestamptz,
  foreign key (household_id, project_id) references public.household_projects(household_id, id),
  foreign key (household_id, converted_project_id) references public.household_projects(household_id, id)
);
create index household_decisions_household_idx on public.household_decisions(household_id);
alter table public.household_decisions enable row level security;
revoke all on public.household_decisions from public, anon, authenticated;
grant select, insert, update on public.household_decisions to authenticated;
create policy household_decisions_read on public.household_decisions for select to authenticated
  using (private.is_household_member(household_id));
create policy household_decisions_create on public.household_decisions for insert to authenticated
  with check (private.is_household_member(household_id) and created_by = (select auth.uid()));
create policy household_decisions_edit on public.household_decisions for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
create trigger household_decisions_identity before update on public.household_decisions
  for each row execute function private.guard_household_record_identity();

create table public.decision_options (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, created_by) references public.household_members(household_id, user_id),
  decision_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 200),
  website text not null default '' check (length(website) <= 2000),
  estimated_amount_cents bigint check (estimated_amount_cents between 0 and 9007199254740991),
  notes text not null default '' check (length(notes) <= 4000),
  chosen boolean not null default false,
  archived_at timestamptz,
  foreign key (household_id, decision_id) references public.household_decisions(household_id, id)
);
create index decision_options_household_idx on public.decision_options(household_id);
alter table public.decision_options enable row level security;
revoke all on public.decision_options from public, anon, authenticated;
grant select, insert, update on public.decision_options to authenticated;
create policy decision_options_read on public.decision_options for select to authenticated
  using (private.is_household_member(household_id));
create policy decision_options_create on public.decision_options for insert to authenticated
  with check (private.is_household_member(household_id) and created_by = (select auth.uid()));
create policy decision_options_edit on public.decision_options for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
create trigger decision_options_identity before update on public.decision_options
  for each row execute function private.guard_household_record_identity();

create table public.household_financial_links (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, created_by) references public.household_members(household_id, user_id),
  financial_event_id uuid not null,
  archived_at timestamptz,
  project_id uuid,
  booking_id uuid,
  asset_id uuid,
  commitment_id uuid,
  check (num_nonnulls(project_id, asset_id, commitment_id) = 1),
  check (booking_id is null or project_id is not null),
  foreign key (household_id, financial_event_id) references public.financial_events(household_id, id),
  foreign key (household_id, project_id) references public.household_projects(household_id, id),
  foreign key (household_id, booking_id) references public.trip_bookings(household_id, id),
  foreign key (household_id, asset_id) references public.household_assets(household_id, id),
  foreign key (household_id, commitment_id) references public.household_commitments(household_id, id),
  unique (household_id, financial_event_id)
);
create index household_financial_links_household_idx on public.household_financial_links(household_id);
alter table public.household_financial_links enable row level security;
revoke all on public.household_financial_links from public, anon, authenticated;
grant select, insert, update on public.household_financial_links to authenticated;
create policy household_financial_links_read on public.household_financial_links for select to authenticated
  using (private.is_household_member(household_id));
create policy household_financial_links_create on public.household_financial_links for insert to authenticated
  with check (private.is_household_member(household_id) and created_by = (select auth.uid()));
create policy household_financial_links_edit on public.household_financial_links for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
create trigger household_financial_links_identity before update on public.household_financial_links
  for each row execute function private.guard_household_record_identity();

create table public.asset_maintenance (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, created_by) references public.household_members(household_id, user_id),
  asset_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 200),
  performed_on date not null,
  routine_id uuid,
  notes text not null default '' check (length(notes) <= 4000),
  archived_at timestamptz,
  foreign key (household_id, asset_id) references public.household_assets(household_id, id),
  foreign key (household_id, routine_id) references public.routines(household_id, id)
);
create index asset_maintenance_household_idx on public.asset_maintenance(household_id);
alter table public.asset_maintenance enable row level security;
revoke all on public.asset_maintenance from public, anon, authenticated;
grant select, insert, update on public.asset_maintenance to authenticated;
create policy asset_maintenance_read on public.asset_maintenance for select to authenticated
  using (private.is_household_member(household_id));
create policy asset_maintenance_create on public.asset_maintenance for insert to authenticated
  with check (private.is_household_member(household_id) and created_by = (select auth.uid()));
create policy asset_maintenance_edit on public.asset_maintenance for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
create trigger asset_maintenance_identity before update on public.asset_maintenance
  for each row execute function private.guard_household_record_identity();

create table public.asset_routines (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, created_by) references public.household_members(household_id, user_id),
  asset_id uuid not null,
  routine_id uuid not null,
  archived_at timestamptz,
  foreign key (household_id, asset_id) references public.household_assets(household_id, id),
  foreign key (household_id, routine_id) references public.routines(household_id, id),
  unique (household_id, asset_id, routine_id)
);
create index asset_routines_household_idx on public.asset_routines(household_id);
alter table public.asset_routines enable row level security;
revoke all on public.asset_routines from public, anon, authenticated;
grant select, insert, update on public.asset_routines to authenticated;
create policy asset_routines_read on public.asset_routines for select to authenticated
  using (private.is_household_member(household_id));
create policy asset_routines_create on public.asset_routines for insert to authenticated
  with check (private.is_household_member(household_id) and created_by = (select auth.uid()));
create policy asset_routines_edit on public.asset_routines for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
create trigger asset_routines_identity before update on public.asset_routines
  for each row execute function private.guard_household_record_identity();

create table public.household_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, created_by) references public.household_members(household_id, user_id),
  title text not null check (length(trim(title)) between 1 and 200),
  file_path text not null,
  project_id uuid,
  booking_id uuid,
  asset_id uuid,
  commitment_id uuid,
  archived_at timestamptz,
  check (num_nonnulls(project_id, asset_id, commitment_id) <= 1),
  check (booking_id is null or project_id is not null),
  check (file_path ~ ('^' || household_id::text || '/(receipts|completions|documents)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$')),
  foreign key (household_id, project_id) references public.household_projects(household_id, id),
  foreign key (household_id, booking_id) references public.trip_bookings(household_id, id),
  foreign key (household_id, asset_id) references public.household_assets(household_id, id),
  foreign key (household_id, commitment_id) references public.household_commitments(household_id, id)
);
create index household_documents_household_idx on public.household_documents(household_id);
alter table public.household_documents enable row level security;
revoke all on public.household_documents from public, anon, authenticated;
grant select, insert, update on public.household_documents to authenticated;
create policy household_documents_read on public.household_documents for select to authenticated
  using (private.is_household_member(household_id));
create policy household_documents_create on public.household_documents for insert to authenticated
  with check (private.is_household_member(household_id) and created_by = (select auth.uid()));
create policy household_documents_edit on public.household_documents for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
create trigger household_documents_identity before update on public.household_documents
  for each row execute function private.guard_household_record_identity();

create unique index decision_options_one_chosen on public.decision_options(household_id, decision_id)
  where chosen and archived_at is null;
create index project_tasks_due_idx on public.project_tasks(household_id, due_on) where completed_at is null and archived_at is null;
create index calendar_events_start_idx on public.calendar_events(household_id, starts_at) where cancelled_at is null;
create index commitments_renewal_idx on public.household_commitments(household_id, renewal_on) where archived_at is null and status <> 'ended';

-- A booking-linked record must also reference the booking's own project.
alter table public.trip_bookings add unique (household_id, project_id, id);
alter table public.household_financial_links add foreign key (household_id, project_id, booking_id)
  references public.trip_bookings(household_id, project_id, id);
alter table public.household_documents add foreign key (household_id, project_id, booking_id)
  references public.trip_bookings(household_id, project_id, id);

create function private.stamp_project_task_completion()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.completed_at is null then
    new.completed_by_member_id := null;
  elsif tg_op = 'INSERT' or old.completed_at is null then
    new.completed_at := now();
    new.completed_by_member_id := auth.uid();
  else
    new.completed_at := old.completed_at;
    new.completed_by_member_id := old.completed_by_member_id;
  end if;
  return new;
end;
$$;
revoke all on function private.stamp_project_task_completion() from public, anon, authenticated;
create trigger project_tasks_completion before insert or update on public.project_tasks
  for each row execute function private.stamp_project_task_completion();

create function public.choose_household_decision_option(p_decision_id uuid, p_option_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_decision public.household_decisions%rowtype;
begin
  select * into v_decision from public.household_decisions where id = p_decision_id for update;
  if not found then raise exception 'Decision not found' using errcode = '42501'; end if;
  if p_option_id is not null and not exists (
    select 1 from public.decision_options where id = p_option_id and decision_id = p_decision_id
      and household_id = v_decision.household_id and archived_at is null
  ) then raise exception 'Option not found' using errcode = '23514'; end if;
  update public.decision_options set chosen = false where decision_id = p_decision_id and chosen;
  update public.decision_options set chosen = true where id = p_option_id;
  update public.household_decisions set status = case when p_option_id is null then 'considering' else 'decided' end
    where id = p_decision_id;
end;
$$;
revoke all on function public.choose_household_decision_option(uuid, uuid) from public, anon;
grant execute on function public.choose_household_decision_option(uuid, uuid) to authenticated;

create function public.convert_household_decision(p_decision_id uuid, p_kind text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_decision public.household_decisions%rowtype; v_project_id uuid;
begin
  select * into v_decision from public.household_decisions where id = p_decision_id for update;
  if not found then raise exception 'Decision not found' using errcode = '42501'; end if;
  if v_decision.converted_project_id is not null then return v_decision.converted_project_id; end if;
  if p_kind not in ('trip', 'project') then raise exception 'Invalid project kind' using errcode = '23514'; end if;
  insert into public.household_projects (household_id, kind, title, description)
    values (v_decision.household_id, p_kind, left(v_decision.title, 160), v_decision.notes)
    returning id into v_project_id;
  update public.household_decisions set converted_project_id = v_project_id, status = 'decided'
    where id = p_decision_id;
  return v_project_id;
end;
$$;
revoke all on function public.convert_household_decision(uuid, text) from public, anon;
grant execute on function public.convert_household_decision(uuid, text) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['household_projects', 'project_tasks', 'calendar_events',
    'trip_bookings', 'household_contacts', 'household_assets', 'household_commitments',
    'household_decisions', 'decision_options', 'household_financial_links', 'household_documents',
    'asset_maintenance', 'asset_routines', 'grocery_categories'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
