-- Deploy with the calendar import projection from 9eba6f9: custom VTIMEZONE
-- resources retain their original ICS, while their relational time_zone is UTC.
create function private.is_supported_calendar_time_zone(p_time_zone text)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from pg_catalog.pg_timezone_names zone
    where pg_catalog.lower(zone.name collate "C") = pg_catalog.lower(p_time_zone collate "C")
  );
$$;
revoke all on function private.is_supported_calendar_time_zone(text) from public, anon, authenticated;
grant execute on function private.is_supported_calendar_time_zone(text) to authenticated, service_role;

alter table public.calendar_events
  add constraint calendar_events_supported_time_zone
  check (private.is_supported_calendar_time_zone(time_zone));
alter table public.trip_bookings
  add constraint trip_bookings_supported_time_zone
  check (private.is_supported_calendar_time_zone(time_zone)),
  add constraint trip_bookings_supported_end_time_zone
  check (private.is_supported_calendar_time_zone(end_time_zone));
