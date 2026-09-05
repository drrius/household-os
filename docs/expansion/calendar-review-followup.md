# Calendar review follow-up

Implemented on the calendar source branch and propagated through the planning/search integration stack:

- Interrupted response-body reads retain the typed retryable network error; existing calendar error codes remain intact.
- Local edits reject unsupported DTEND zones as well as DTSTART zones, preserving imported definitions.
- One failed pending event no longer prevents the rest of the bounded 20-event batch from being attempted. Sync still fails visibly and releases its lease with the original error; event-specific errors remain recorded by the existing push command.
- Conflict comparison formats complete local intervals and names their time zones. Missing locations have no trailing separator. Unreadable remote data is distinguished from deletion. Parsing/formatting run on the server, with the choice form retaining its client boundary.

Evidence: the transport and custom-zone regressions failed before their fixes; 40 affected tests passed afterward. The queue regressions failed before the fix; 24 sync/push/protocol tests passed afterward. Fifteen sync/push/time-presentation tests and two focused Chromium/mobile Safari conflict cases pass, including accessible choice selection and no hydration warnings. Targeted lint, formatting and TypeScript pass. These are controlled tests, not live private-iCloud verification.

Outstanding review work includes recurrence export identity/time-zone semantics, recurrence-rule storage, booking restore invariants and remaining source-PR findings. Hosted final-head CI and positive CodeRabbit review remain required.

Occurrence editing now returns an explicit recovery state for malformed, duplicate, cancelled, excluded or unreadable occurrence data, with a route back to the event. Valid occurrences retain their date-specific editor. Both event routes reject malformed UUIDs with not-found before querying the database. Twenty affected row/occurrence tests, targeted lint, formatting and TypeScript pass. Route browser CI remains required.

Export recurrence identity validation now preserves the effective instant across time zones, and detects duplicate exceptions even when their TZID representations differ. The two regressions failed before the fix. Forty-two affected export/occurrence/push tests pass, including a property spanning series dates and three time-zone representations; targeted lint, formatting and domain typechecking pass. Cross-zone read/edit behavior and matching VTIMEZONE serialization still require separate assessment.

The recurrence snapshot type guard is prepared as a new migration, preserving prior migration history and function permissions. It rejects number, boolean, object and array values before snapshot writes; string, JSON null and absent values remain supported. Six focused SQL regressions were added. Local execution failed because PostgreSQL at 127.0.0.1:54322 is unavailable; hosted database CI is required before this finding is resolved.

New and edited events now add missing VTIMEZONE definitions for each referenced named zone, preserving existing definitions and matching aliases to their actual TZID references. `timezones-ical-library` is pinned at 2.3.1 (Apache-2.0, bundled IANA-derived data, no runtime network request). This follows [RFC 5545's timezone component requirement](https://www.rfc-editor.org/rfc/rfc5545#section-3.2.19); data provenance and update procedures are documented by the [library](https://github.com/add2cal/timezones-ical-library). Keep the pinned timezone data current when rules change.

Fifty-six affected calendar tests pass. New checks parse serialized output with ICAL directly, without Household OS's IANA fallback, and verify Zurich/New York clock changes, year-round instant round-trips in four zones including aliases and fractional offsets, unchanged existing definitions on edit, and UTC/all-day output. Targeted lint, formatting and both app/domain TypeScript checks pass. This closes the missing-definition implementation finding; final CI/review and cross-zone exception read/edit behavior remain separate gates.
