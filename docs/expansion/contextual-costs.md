# Contextual paid costs

Money now exposes paid costs for trips/projects, inventory and recurring commitments. The record list includes active and archived records with bounded paging. Each context shows the exact all-history total from the authoritative financial read model, plus keyset-paged activity. Booking filters survive payment entry and return navigation. Refunds, reversals and replacements retain their inherited context without becoming new payments or altering estimates.

The expense form uses the existing exact CHF parser and equal/exact allocation controls. Its stable request identity survives failed submissions and realtime refresh. `post_contextual_expense` authenticates the household, serializes on the existing money command key, locks the parent/booking, and posts the expense, financial link and private retry receipt in one transaction. The receipt binds every financial and contextual input; a key already used by an unrelated manual command is rejected. Identical retries acknowledge the existing event even after archive or intentional link changes, without restoring or overwriting those changes. Cancelled bookings and ended commitments can still have a real final payment; archived records require restoration before new posting.

The read layer validates route kinds, IDs, complete cursors and matching booking/project scope. Totals remain decimal strings until BigInt formatting, preserving precision above JavaScript's safe-integer range. Money refreshes on changes to context names/archive state, bookings, links and authoritative financial events. Receipt uploads remain private and the database attachment claim participates in rollback.

## Verification

- Full `pnpm verify`: 386 tests across 63 files, lint, types, formatting, passkey configuration check and production build passed.
- Nine Playwright cases passed across Chromium, WebKit and mobile Safari after component extraction: exact large totals, payment details/booking links, pagination links, empty/archive states, preserved error inputs/request identity, and successful return navigation.
- Server-action and query tests cover tenant scoping, invalid targets/receipts, exact splits, uncertain responses, framework redirects and bounded paging. Example/property tests cover exact large centime formatting and the command payload.
- Database test 028 covers authorization/private receipt privileges, payload-bound retries, manual/context key collisions, parent/booking archive behavior, intentional link changes, derived totals, zero-sum posting, and a forced post-ledger link failure rolling back the event, activity, command receipts and attachment claim. Local `pnpm db:test` was attempted but PostgreSQL at 127.0.0.1:54322 refused the connection; execution remains a CI gate.
- Temporary build-cache quota interrupted an earlier run. Inactive generated `.next` caches were cleared; the subsequent full verification and browser run passed.

## Remaining integration and review gates

This branch starts from PR48 (`58982b8`). It does not import the pending PR44 attachment dependency; existing migration 015 and receipt test 028 still need that integration. No production migration, deployment, or PR merge was performed. Codex review quota is exhausted, so positive review remains outstanding.

Record detail pages in PR51/52 still need direct links to these routes after authorized integration. Linking/reassigning an already-recorded expense, complete bookings/itinerary, assembled navigation and the fresh whole-app completeness audit remain required follow-up work. This implementation is not evidence that those journeys are complete.
