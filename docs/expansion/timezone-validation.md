# Named timezone validation

Calendar and booking row timezones must be names recognized by PostgreSQL's [pg_timezone_names catalog](https://www.postgresql.org/docs/current/view-pg-timezone-names.html). Migration `20260905004500_calendar_timezone_validation.sql` checks `calendar_events.time_zone`, `trip_bookings.time_zone`, and `trip_bookings.end_time_zone` at the database boundary, including direct authenticated inserts and updates.

The private validator uses an exact, case-insensitive comparison with catalog names. It accepts existing named aliases such as `US/Eastern` and keeps their original spelling. It rejects numeric offsets, unknown names, custom iCalendar TZIDs, whitespace padding, and wildcard patterns. Departure and arrival may use different valid zones. The validator is stable and independent of authentication; existing row-level security still controls household access. Authenticated and service roles have the execution privilege needed by the checks.

## Required integration and deployment order

**This constraint and calendar commit `9eba6f9` must ship together.** The calendar import projection in that commit stores UTC in the relational timezone field for unsupported custom TZIDs while retaining the original `TZID`, `VTIMEZONE`, and complete resource in `ical_data`. Agenda expansion and master/occurrence details continue to read the original iCalendar definition. Such events remain editable in Apple Calendar, so changing a database projection never rewrites their timezone semantics.

Do not deploy the constraint with the earlier import writer, which writes custom TZIDs directly into `calendar_events.time_zone`. Do not copy the calendar implementation into the schema branch to bypass its dependency. Validate the assembled calendar and schema branches together, including a custom `VTIMEZONE` import and a flight with different departure and arrival zones.

The migration validates existing rows and does not silently repair invalid values. Before deployment, compare existing timezone values with `pg_timezone_names` using the same case-insensitive equality. If pre-release custom imports exist, reproject their original ICS using the calendar reader before applying the constraints. Arbitrary invalid timezone strings require an explicit correct timezone; guessing UTC would change their meaning. Existing valid catalog names need no backfill.

## Verification

`024_calendar_timezone_validation.test.sql` covers named zones and aliases, exact case-insensitive matching, wildcard/offset rejection, every column's direct insert and update boundaries, validator privileges, partner access, tenant isolation, and unchanged financial history. Run `pnpm db:test` on the assembled branch. Local PostgreSQL was unavailable during implementation; database execution must be confirmed in CI before release. These checks do not require or claim live iCloud account verification.
