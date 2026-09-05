# Inbox lifecycle and navigation

This lane starts from main at `51fac2c`; it does not integrate other feature branches.

Inbox provides All and Unread views, older-message navigation, explicit per-message read controls, and “Mark this page read.” Actions keep the current filter and cursor, report pending and recoverable failures, and refresh Inbox, notification settings, and Today only after the authoritative command succeeds.

Paging orders by `(created_at DESC, id DESC)` and preserves Postgres timestamp precision in a validated cursor. The reader fetches at most 41 records to display 40 and detect the next page. Counts use head-only queries; unread IDs come only from the visible page. `loadInboxFeed(limit = 40)` remains compatible with notification settings, which requests five items. Read batches contain at most 40 validated UUIDs; the command verifies household and recipient ownership and checks the existing RPC result.

Links use validated entity IDs and bounded household-scoped availability queries. This base has direct routine editors, planned-meal pages, and pending-expense draft review routes. Missing, archived, removed, or unavailable entities use established section fallbacks. Financial-event, shopping-session, and occurrence detail routes from other branches are not assumed to exist. Payload URLs are ignored and payload contents are not fetched for this view.

An empty unread view distinguishes first use from being caught up. If notification counts change concurrently, the view asks the member to refresh instead of incorrectly claiming everything is read. Invalid saved cursor URLs have a clear route back to the latest messages.

## Verification

- `pnpm verify` passed: formatting, lint, type checks, 49 test files / 275 tests, WebAuthn gate, and production build.
- Eight Playwright flows passed on Chromium and mobile Safari, serially against the isolated fixture server on port 3032. Coverage includes equal-timestamp paging, filter/context preservation, bounded page marking, item/page pending states and recoverable failures, caught-up/first-use states, and invalid-cursor recovery.
- Property and unit tests cover cursor precision and UUID tie-breakers, invalid cursor/ID rejection, bounded queries, tenant/recipient authorization, safe destinations, stale action results, and Today revalidation.
- No migration is required. Existing Inbox RLS, indexes, and `mark_inbox_notifications_read` are retained. Browser tests use controlled fixture actions; they do not claim live Supabase verification or production deployment.
