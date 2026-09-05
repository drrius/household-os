# Expansion review progress — 5 September 2026

The authoritative scope is [goal.md](goal.md): discover and implement worthwhile gaps across the whole app, beyond the starting workflow list. This is active work, not a completion report.

## Verified review outcomes

- PR45, meals, commit `5a8c385`: Codex explicitly reported no major issues and reacted 👍 at 00:01:11 UTC. Full verification and 16 focused browser cases passed locally. The new archive permission fix still requires its database CI result to be checked.
- PR49, Money, commit `aa16a8d`: Codex explicitly reported no major issues and reacted 👍 at 23:46:37 UTC on 4 September. Database CI passed. The browser job was interrupted by runner shutdown and has been retried; interruption is not a test pass.
- PR44, PR46, PR47, PR50 and PR53 have received fixes and rereview requests. A completed review status alone is not approval. Later changes require fresh review.
- PR48 at `1007c7a` passed database CI, including the financial-context and document-lifecycle tests. Review coverage must be refreshed for the updated head.

## Additional required gaps found

- Uncontrolled edit forms can retain dirty values while realtime refresh advances a hidden version token. Project/task forms now freeze identity, initial values and version together. Grocery, category, household-record and calendar forms are being corrected on their respective branches with browser regressions.
- Recurring-expense and routine-definition edits lack a complete atomic expected-version check. These remain required work. Routine optional-field changes must join the same transaction, and recurring edits must not overwrite a next date advanced by draft generation.
- Inbox paging, unread filtering, bounded marking, exact safe destinations and recovery are in progress on a separate branch.
- Household search is in progress, including combined item/parent-label matching, bounded pages and tenant authorization.
- Unified navigation/Today, complete bookings and itinerary journeys, checklist starters, contextual expense creation, substantial-form discard protection, push reconciliation/delivery verification and final integrated operational checks remain open.

## Project review fixes

- Preserve each edit's original record snapshot through realtime refresh; switching record identity starts a different editor. Browser cases submit dirty project/task forms after a simulated partner refresh and verify stale-version rejection without losing inputs.
- Order incomplete tasks before completed history, before pagination.
- Lock the parent project in a task-write trigger and reject writes when archived. This serializes with project archive/restore and covers direct authenticated table writes as well as server actions. RLS remains authoritative for tenant access; trusted database fixtures without an auth identity remain supported. Added database cases cover active writes, archive-first rejection, retained earlier work, restoration, actor attribution and tenant boundaries. Actual parallel database execution remains unverified locally.
- Full local verification passed 366 tests and production build; 15 project browser cases passed across all three profiles. Local database verification was attempted but PostgreSQL at 127.0.0.1:54322 was unavailable.

## Integration and external verification

Automatic approval review rejected feature-branch integration and requested additional user authorization. That question is pending. No alternative copying, cherry-picking or other integration workaround has been used. New independent changes and same-branch PR pushes continue.

This prevents treating the PR collection as an integrated product. PR51's route/RPC findings identify implementations already present in PR48/49/52 but still absent from its isolated head. PR50 and PR51 CI currently stop at a missing attachment helper from the updated PR44 dependency. PR52 also needs its base conflicts resolved. These are unresolved integration requirements, not waived findings.

No production migrations, deployments or PR merges were performed. iCloud credentials, live calendar verification and the attachment Edge Function deployment remain setup requirements. Controlled-fixture checks are not claims of live-account success.

## Subsequent work

- Inbox is open as PR54 at `1f443ac` (275 tests/build and eight focused browser cases passed). Search is open as PR55 at `ffd1df5` (377 tests/build and nine browser cases passed); search database tests await CI/dependency integration. Both have Codex review requests.
- The form snapshot fixes are pushed: groceries `2873b44`, household records `f72213e`, calendar `8d7c2b7`. Their full local verification and targeted browser regressions passed. Grocery/Home successful same-page redirects were exercised to ensure a fresh editor lifetime without losing realtime safety.
- Further Codex findings on PR48 remain required: supported time-zone validation, connected cost refresh after inherited ledger events, and safe cleanup eligibility for superseded document files with no remaining references. Custom iCalendar VTIMEZONE resources must remain supported without mislabelling their times.
- Calendar rereview found further recurrence-identity/RANGE cancellation, repeated parsing, prepared-version error recording and missing end-boundary issues. These are being fixed in the calendar lane.
- Money versioned recurring edits are underway (020); routine edits and meal-preparation adapters follow (019). Push registration reconciliation and a bounded current-device test are underway (021).

## Starter checklists

Projects and trips need useful starting work without filling the household with irrelevant tasks. Offer selectable project-start, travel-planning, packing and home-preparation checklists. The user previews and selects each task before adding it; ordinary assignment/edit/removal remains available afterward. These are planning tasks only and never financial events or automatic changes to recurring household work.

Batch additions lock the parent, authenticate household membership, validate at most twenty items, and commit atomically. Stable task IDs make uncertain-response retries safe without overwriting subsequent edits or restoring removed tasks. Fresh requests skip matching active/completed checklist items. Removed items can be deliberately added again with a new request. Database regression coverage includes retries, actor identity, tenant/foreign-ID denial, complete rollback, archived parents and integer position saturation.

Starter checklist final verification passed: 374 unit tests, production build and six browser cases across Chromium, WebKit and mobile Safari. Independent review found a skipped-duplicate retry could recreate a task after the partner edited it. The batch now stores private, household-scoped selection receipts for added and skipped selections, binds each identity to its payload, and rolls receipts back with a failed batch. Test022 covers edited/archived duplicate replay, payload mismatch, private receipt access and rollback. Database execution remains a CI gate.

Inbox PR54 at1f443ac received an explicit no-issues Codex review and passed verify and browser CI. Calendar9eba6f9 is pushed with a new Codex review request; all433 unit tests and27 browser cases passed. Device push setup2b8b7b0 is pushed for its own PR, with279 tests,8 browser cases,2 Deno fixture checks and worker typecheck passing. Search review identified Unicode output validation and missing document parent labels; fixes are assigned. Search detail destinations remain a known dependency-integration gate.

Further shared-form audit: preserve Next framework redirect/notFound signals through form action recovery, expose a correct back label for read-only detail pages, and investigate the mobile skip-link visibility artifact. Routine019 review found missing partner notification when clearing both active-window bounds; the owning lane is resolving it before commit. Meals preparation must adopt the versioned routine edit contract in its own follow-up commit.
