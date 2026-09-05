# Home records CodeRabbit follow-up

CodeRabbit is the current PR reviewer, replacing Codex at the user’s request.

## Changes

- Normalize repeated URL query parameters at the shared page boundary.
- Detect draft changes from editable fields only, excluding a fixed parent identity; memoize the snapshot key.
- Preserve lifecycle fields when the browser fixture edits existing records.
- Apply attention filtering, ordering, counting, and pagination in Postgres rather than loading all historical records.
- Require the displayed edit version when archiving or restoring decision options, with monotonic home-record versions.
- Keep decision-option parents immutable and reject status changes combined with restoring an archived decision.
- Add activity constraints without validating under the initial exclusive lock; validate in a later migration.
- Move shared record actions out of inventory, preserve authentication redirects, choose contextual error destinations, and sort choices by label then ID.
- Repair joined words in the verification notes.

The proposed fallback for invalid commitment notice days was declined: the database requires an integer between 0 and 730, so the reported state is not representable through the supported data model.

## Verification

- `pnpm verify`: passed, including 406 unit/property tests and the production build.
- Home records, concurrent refresh, pristine parented creation, navigation, and archived fixture editing: 54 Playwright cases passed across desktop Chromium, mobile Chromium, and mobile Safari.
- Database tests 034 and 037 cover archive guards, immutable option parents, monotonic versions, stale option archival, tenant isolation, and attention pagination. Local `pnpm db:test` could not connect to Postgres on port 54322; no local SQL pass is claimed.

## Integration dependencies

Hosted CI is available following the repository visibility change. Its fresh result remains required. This branch still needs its connected-household and attachment dependencies before the complete database suite can pass. The versioned archive wrapper calls the connected-household archive command; it does not copy that pending dependency into this branch. No production database was changed.
