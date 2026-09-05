alter table public.calendar_events
  validate constraint calendar_events_supported_time_zone;

alter table public.trip_bookings
  validate constraint trip_bookings_supported_time_zone;

alter table public.trip_bookings
  validate constraint trip_bookings_supported_end_time_zone;
