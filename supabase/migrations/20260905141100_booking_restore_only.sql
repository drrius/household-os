-- Restore is a lifecycle transition, not an edit of an archived booking.
create or replace function private.guard_trip_booking_lifecycle()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_project public.household_projects%rowtype;
begin
  select * into v_project from public.household_projects
    where id=new.project_id and household_id=new.household_id for update;
  if not found then raise exception 'Trip not found' using errcode='42501'; end if;
  if not private.is_supported_calendar_time_zone(new.time_zone)
    or not private.is_supported_calendar_time_zone(new.end_time_zone) then
    raise exception 'Bookings require valid named time zones' using errcode='23514';
  end if;
  if v_project.kind<>'trip' then raise exception 'Bookings require a trip' using errcode='23514'; end if;
  if v_project.archived_at is not null then raise exception 'Restore this trip before changing bookings' using errcode='55000'; end if;
  if tg_op='UPDATE' then
    if new.project_id<>old.project_id then raise exception 'A booking cannot change trips' using errcode='23514'; end if;
    -- Stored generated columns are not populated in NEW before this trigger.
    if old.archived_at is not null and (
      new.archived_at is not null or
      (to_jsonb(new) - 'archived_at' - 'updated_at' - 'project_kind') is distinct from
      (to_jsonb(old) - 'archived_at' - 'updated_at' - 'project_kind')
    ) then
      raise exception 'Restore this booking before changing it' using errcode='55000';
    end if;
    new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
  end if;
  return new;
end;
$$;
