# Calendar review follow-up

Implemented on the calendar source branch and propagated through the planning/search integration stack:

- Interrupted response-body reads retain the typed retryable network error; existing calendar error codes remain intact.
- Local edits reject unsupported DTEND zones as well as DTSTART zones, preserving imported definitions.
- One failed pending event no longer prevents the rest of the bounded 20-event batch from being attempted. Sync still fails visibly and releases its lease with the original error; event-specific errors remain recorded by the existing push command.
- Conflict comparison formats complete local intervals and names their time zones. Missing locations have no trailing separator. Unreadable remote data is distinguished from deletion. Parsing/formatting run on the server, with the choice form retaining its client boundary.

Evidence: the transport and custom-zone regressions failed before their fixes; 40 affected tests passed afterward. The queue regressions failed before the fix; 24 sync/push/protocol tests passed afterward. Fifteen sync/push/time-presentation tests and two focused Chromium/mobile Safari conflict cases pass, including accessible choice selection and no hydration warnings. Targeted lint, formatting and TypeScript pass. These are controlled tests, not live private-iCloud verification.

Outstanding review work includes occurrence-query recovery, recurrence export identity/time-zone semantics, recurrence-rule storage, booking restore invariants and remaining source-PR findings. Hosted final-head CI and positive CodeRabbit review remain required.
