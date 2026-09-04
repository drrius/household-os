create table public.calendar_connections (
 id uuid primary key default extensions.gen_random_uuid(),
 household_id uuid not null unique references public.households(id),
 connected_by uuid not null default auth.uid(),
 encrypted_credentials text not null check(length(encrypted_credentials) between 20 and 4096),
 selected_calendar_url text check(length(selected_calendar_url)<=2000),
 calendar_name text check(length(calendar_name)<=500),
 read_only boolean not null default true,
 last_synced_at timestamptz,
 last_error text check(length(last_error)<=500),
 sync_lock uuid,
 sync_lock_until timestamptz,
 check ((sync_lock is null)=(sync_lock_until is null)),
 created_at timestamptz not null default now(),
 unique(household_id,id),
 foreign key(household_id,connected_by) references public.household_members(household_id,user_id)
);
alter table public.calendar_connections enable row level security;
revoke all on public.calendar_connections from public,anon,authenticated;
grant select on public.calendar_connections to authenticated;
grant insert(id,household_id,connected_by,encrypted_credentials) on public.calendar_connections to authenticated;
grant update(encrypted_credentials,selected_calendar_url,calendar_name,read_only) on public.calendar_connections to authenticated;
create policy calendar_connections_read on public.calendar_connections for select to authenticated using(private.is_household_member(household_id));
create policy calendar_connections_create on public.calendar_connections for insert to authenticated with check(private.is_household_member(household_id) and connected_by=(select auth.uid()));
create policy calendar_connections_edit on public.calendar_connections for update to authenticated using(private.is_household_member(household_id)) with check(private.is_household_member(household_id));
create policy calendar_connections_remove on public.calendar_connections for delete to authenticated using(private.is_household_member(household_id));

alter table public.calendar_events
 add column ical_uid text not null default (extensions.gen_random_uuid()::text || '@household-os') check(length(ical_uid) between 1 and 512),
 add column ical_data text check(length(ical_data)<=524288),
 add column ical_edit_base text check(length(ical_edit_base)<=524288),
 add column connection_id uuid,
 add column remote_href text check(length(remote_href)<=2000),
 add column remote_etag text check(length(remote_etag)<=1000),
 add column sync_state text not null default 'local' check(sync_state in('local','pending','synced','conflict')),
 add column last_synced_ical text check(length(last_synced_ical)<=524288),
 add column remote_conflict_ical text check(length(remote_conflict_ical)<=524288),
 add column remote_conflict_etag text check(length(remote_conflict_etag)<=1000),
 add column last_sync_error text check(length(last_sync_error)<=500),
 add foreign key(household_id,connection_id) references public.calendar_connections(household_id,id),
 add unique(household_id,ical_uid),
 add check ((connection_id is null)=(sync_state='local'));
create unique index calendar_events_remote_href_idx on public.calendar_events(connection_id,remote_href) where remote_href is not null;

create or replace function public.claim_calendar_sync(p_connection_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare connection public.calendar_connections%rowtype; token uuid:=extensions.gen_random_uuid();
begin
 select * into connection from public.calendar_connections where id=p_connection_id for update;
 if not found or auth.uid() is null or not private.is_household_member(connection.household_id) then raise exception 'calendar access denied' using errcode='42501'; end if;
 if connection.sync_lock_until>now() then raise exception 'calendar sync already running' using errcode='55P03'; end if;
 update public.calendar_connections set sync_lock=token,sync_lock_until=now()+interval '180 seconds' where id=connection.id;
 return token;
end; $$;

create or replace function private.require_calendar_lease(p_connection_id uuid,p_token uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare connection public.calendar_connections%rowtype;
begin
 select * into connection from public.calendar_connections where id=p_connection_id for update;
 if not found or auth.uid() is null or not private.is_household_member(connection.household_id) then raise exception 'calendar access denied' using errcode='42501'; end if;
 if p_token is null or connection.sync_lock is null or connection.sync_lock is distinct from p_token or connection.sync_lock_until<=now() then raise exception 'calendar sync lease expired' using errcode='55P03'; end if;
 return connection.household_id;
end; $$;

create or replace function public.release_calendar_sync(p_connection_id uuid,p_token uuid,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_calendar_lease(p_connection_id,p_token);
 update public.calendar_connections set sync_lock=null,sync_lock_until=null,last_error=p_error,
 last_synced_at=case when p_error is null then now() else last_synced_at end where id=p_connection_id;
end; $$;

create or replace function public.reconcile_calendar_snapshot(p_connection_id uuid,p_token uuid,p_events jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare tenant uuid; remote jsonb; local_event public.calendar_events%rowtype; seen text[]:='{}';
begin
 tenant:=private.require_calendar_lease(p_connection_id,p_token);
 if p_events is null or jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>2000 then raise exception 'invalid calendar snapshot'; end if;
 if exists(select 1 from jsonb_array_elements(p_events) item where jsonb_typeof(item)<>'object' or jsonb_typeof(item->'uid') is distinct from 'string' or nullif(item->>'uid','') is null or jsonb_typeof(item->'href') is distinct from 'string' or nullif(item->>'href','') is null or jsonb_typeof(item->'etag') is distinct from 'string' or nullif(item->>'etag','') is null or jsonb_typeof(item->'ical') is distinct from 'string' or nullif(item->>'ical','') is null or jsonb_typeof(item->'title') is distinct from 'string' or jsonb_typeof(item->'startsAt') is distinct from 'string' or jsonb_typeof(item->'endsAt') is distinct from 'string' or jsonb_typeof(item->'timeZone') is distinct from 'string' or jsonb_typeof(item->'location') is distinct from 'string' or jsonb_typeof(item->'notes') is distinct from 'string' or jsonb_typeof(item->'allDay') is distinct from 'boolean' or jsonb_typeof(item->'cancelled') is distinct from 'boolean') then raise exception 'invalid calendar snapshot entry'; end if;
 if exists(select 1 from jsonb_array_elements(p_events) item group by item->>'uid' having count(*)>1) or exists(select 1 from jsonb_array_elements(p_events) item group by item->>'href' having count(*)>1) then raise exception 'duplicate calendar snapshot entry'; end if;
 for remote in select value from jsonb_array_elements(p_events) loop
  if nullif(remote->>'href','') is null or nullif(remote->>'etag','') is null or nullif(remote->>'ical','') is null then raise exception 'incomplete calendar snapshot'; end if;
  seen:=array_append(seen,remote->>'href');
  select * into local_event from public.calendar_events where household_id=tenant and ical_uid=remote->>'uid' for update;
  if not found then
   insert into public.calendar_events(household_id,created_by,title,starts_at,ends_at,time_zone,all_day,location,notes,recurrence_rule,cancelled_at,ical_uid,ical_data,connection_id,remote_href,remote_etag,sync_state,last_synced_ical)
   values(tenant,auth.uid(),remote->>'title',(remote->>'startsAt')::timestamptz,(remote->>'endsAt')::timestamptz,remote->>'timeZone',(remote->>'allDay')::boolean,remote->>'location',remote->>'notes',remote->>'recurrenceRule',case when (remote->>'cancelled')::boolean then now() end,remote->>'uid',remote->>'ical',p_connection_id,remote->>'href',remote->>'etag','synced',remote->>'ical');
  elsif local_event.ical_data=remote->>'ical' then
   update public.calendar_events set connection_id=p_connection_id,remote_href=remote->>'href',remote_etag=remote->>'etag',last_synced_ical=remote->>'ical',sync_state=case when cancelled_at is not null and not (remote->>'cancelled')::boolean then 'pending' else 'synced' end,remote_conflict_ical=null,remote_conflict_etag=null,last_sync_error=null where id=local_event.id;
  elsif local_event.sync_state in('pending','conflict','local') and local_event.ical_data is distinct from local_event.last_synced_ical then
   if local_event.remote_etag is distinct from remote->>'etag' and local_event.last_synced_ical is distinct from remote->>'ical' then
    update public.calendar_events set connection_id=p_connection_id,remote_href=remote->>'href',sync_state='conflict',remote_conflict_ical=remote->>'ical',remote_conflict_etag=remote->>'etag',last_sync_error='Both versions changed. Choose which version to keep.' where id=local_event.id;
   else
    update public.calendar_events set connection_id=p_connection_id,remote_href=remote->>'href',remote_etag=remote->>'etag' where id=local_event.id;
   end if;
  else
   update public.calendar_events set title=remote->>'title',starts_at=(remote->>'startsAt')::timestamptz,ends_at=(remote->>'endsAt')::timestamptz,time_zone=remote->>'timeZone',all_day=(remote->>'allDay')::boolean,location=remote->>'location',notes=remote->>'notes',recurrence_rule=remote->>'recurrenceRule',cancelled_at=case when (remote->>'cancelled')::boolean then now() end,ical_data=remote->>'ical',connection_id=p_connection_id,remote_href=remote->>'href',remote_etag=remote->>'etag',sync_state='synced',last_synced_ical=remote->>'ical',remote_conflict_ical=null,remote_conflict_etag=null,last_sync_error=null where id=local_event.id;
  end if;
 end loop;
 for local_event in select * from public.calendar_events where connection_id=p_connection_id and household_id=tenant and remote_href is not null and not(remote_href=any(seen)) and remote_etag is not null for update loop
  if local_event.sync_state in('pending','conflict') and local_event.cancelled_at is null then
   update public.calendar_events set sync_state='conflict',remote_conflict_ical='',remote_conflict_etag=null,last_sync_error='This event was deleted in Apple Calendar.' where id=local_event.id;
  else
   update public.calendar_events set cancelled_at=coalesce(cancelled_at,now()),sync_state='synced',remote_etag=null,last_synced_ical=null,remote_conflict_ical=null,remote_conflict_etag=null,last_sync_error=null where id=local_event.id;
  end if;
 end loop;
end; $$;

create or replace function public.record_calendar_push(p_connection_id uuid,p_token uuid,p_event_id uuid,p_sent_ical text,p_cancelled boolean,p_href text,p_etag text)
returns void language plpgsql security definer set search_path='' as $$
declare tenant uuid;
begin
 tenant:=private.require_calendar_lease(p_connection_id,p_token);
 update public.calendar_events set remote_href=p_href,remote_etag=p_etag,last_synced_ical=p_sent_ical,
 sync_state=case when ical_data=p_sent_ical and (cancelled_at is not null)=p_cancelled then 'synced' else 'pending' end,
 remote_conflict_ical=null,remote_conflict_etag=null,last_sync_error=null
 where id=p_event_id and household_id=tenant and connection_id=p_connection_id;
 if not found then raise exception 'calendar event no longer belongs to connection'; end if;
end; $$;

create or replace function public.disconnect_calendar(p_connection_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare connection public.calendar_connections%rowtype;
begin
 select * into connection from public.calendar_connections where id=p_connection_id for update;
 if not found or auth.uid() is null or not private.is_household_member(connection.household_id) then raise exception 'calendar access denied' using errcode='42501'; end if;
 if connection.sync_lock_until>now() then raise exception 'wait for calendar sync to finish' using errcode='55P03'; end if;
 update public.calendar_events set connection_id=null,remote_href=null,remote_etag=null,sync_state='local',remote_conflict_ical=null,remote_conflict_etag=null,last_sync_error=null where connection_id=connection.id;
 delete from public.calendar_connections where id=connection.id;
end; $$;

revoke all on function private.require_calendar_lease(uuid,uuid) from public,anon,authenticated;
revoke all on function public.claim_calendar_sync(uuid),public.release_calendar_sync(uuid,uuid,text),public.reconcile_calendar_snapshot(uuid,uuid,jsonb),public.record_calendar_push(uuid,uuid,uuid,text,boolean,text,text),public.disconnect_calendar(uuid) from public,anon;
grant execute on function public.claim_calendar_sync(uuid),public.release_calendar_sync(uuid,uuid,text),public.reconcile_calendar_snapshot(uuid,uuid,jsonb),public.record_calendar_push(uuid,uuid,uuid,text,boolean,text,text),public.disconnect_calendar(uuid) to authenticated;

create function private.guard_calendar_connection() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.household_id<>old.household_id or new.connected_by<>old.connected_by or new.created_at<>old.created_at then raise exception 'calendar connection identity is immutable'; end if;
 if (new.selected_calendar_url is distinct from old.selected_calendar_url or new.encrypted_credentials is distinct from old.encrypted_credentials or new.read_only is distinct from old.read_only) then
  if old.sync_lock_until>now() then raise exception 'wait for calendar sync to finish' using errcode='55P03'; end if;
  if old.selected_calendar_url is not null and new.selected_calendar_url is distinct from old.selected_calendar_url then raise exception 'disconnect before selecting another calendar'; end if;
 end if;
 return new;
end; $$;
create trigger guard_calendar_connection before update on public.calendar_connections for each row execute function private.guard_calendar_connection();


-- Normal event edits (including linked booking edits) must never bypass the outbox.
-- Security-definer reconciliation functions own remote acknowledgement metadata.
create function private.guard_calendar_event_sync() returns trigger language plpgsql set search_path='' as $$
declare changed boolean; resolved_remote boolean;
begin
 if current_user <> 'authenticated' then return new; end if;
 if tg_op='INSERT' then
  if new.connection_id is not null then new.sync_state:='pending'; new.remote_href:=null; new.remote_etag:=null; new.last_synced_ical:=null; end if;
  return new;
 end if;
 resolved_remote:=coalesce(old.sync_state='conflict' and new.remote_conflict_ical is null and (new.ical_data=old.remote_conflict_ical or old.remote_conflict_ical='' and new.cancelled_at is not null) and new.remote_etag is not distinct from old.remote_conflict_etag,false);
 if new.remote_href is distinct from old.remote_href or (new.remote_etag is distinct from old.remote_etag and not resolved_remote and not(old.sync_state='conflict' and new.remote_conflict_ical is null and new.sync_state='pending' and new.remote_etag is not distinct from old.remote_conflict_etag)) then raise exception 'remote calendar metadata is owned by sync'; end if;
 if new.last_synced_ical is distinct from old.last_synced_ical and not(old.sync_state='conflict' and new.remote_conflict_ical is null and new.last_synced_ical is not distinct from nullif(old.remote_conflict_ical,'')) then raise exception 'remote calendar baseline is owned by sync'; end if;
 if row(new.remote_conflict_ical,new.remote_conflict_etag) is distinct from row(old.remote_conflict_ical,old.remote_conflict_etag) and not(old.sync_state='conflict' and new.remote_conflict_ical is null and new.remote_conflict_etag is null and new.sync_state in('pending','synced')) then raise exception 'remote calendar conflicts are owned by sync'; end if;
 if old.connection_id is not null and new.connection_id is distinct from old.connection_id then raise exception 'disconnect the calendar to detach imported events'; end if;
 changed:=row(new.title,new.starts_at,new.ends_at,new.time_zone,new.all_day,new.location,new.notes,new.recurrence_rule,new.cancelled_at) is distinct from row(old.title,old.starts_at,old.ends_at,old.time_zone,old.all_day,old.location,old.notes,old.recurrence_rule,old.cancelled_at);
 if new.connection_id is not null and not resolved_remote then
  if changed and new.ical_data is not distinct from old.ical_data then new.ical_edit_base:=coalesce(old.ical_data,old.ical_edit_base); new.ical_data:=null; end if;
  if changed or new.ical_data is distinct from old.ical_data or old.connection_id is null then new.sync_state:=case when old.sync_state='conflict' and new.remote_conflict_ical is not null then 'conflict' else 'pending' end;
  elsif old.sync_state in('pending','conflict') and new.sync_state='synced' then raise exception 'only sync can acknowledge pending calendar edits'; end if;
 end if;
 return new;
end; $$;
create trigger calendar_event_sync before insert or update on public.calendar_events for each row execute function private.guard_calendar_event_sync();
