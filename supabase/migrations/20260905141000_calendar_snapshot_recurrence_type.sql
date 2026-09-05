-- Keep recurrence metadata typed before any snapshot writes or removals.
create or replace function public.reconcile_calendar_snapshot(p_connection_id uuid,p_token uuid,p_events jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare tenant uuid; remote jsonb; local_event public.calendar_events%rowtype; seen text[]:='{}';
begin
 tenant:=private.require_calendar_lease(p_connection_id,p_token);
 if p_events is null or jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>2000 then raise exception 'invalid calendar snapshot'; end if;
 if exists (
   select 1 from jsonb_array_elements(p_events) item
   where item ? 'recurrenceRule'
     and jsonb_typeof(item->'recurrenceRule') not in ('string','null')
 ) then raise exception 'invalid calendar snapshot entry'; end if;
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
