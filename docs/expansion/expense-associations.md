# Existing expense associations

Every active paid-cost context now offers “Link recorded expense”. The bounded, keyset-paged picker includes recorded expenses and corrected payments. Confirmation shows the original payment, its current direct association and the destination, preserving booking scope. To move a payment, choose its new record and select the same payment. Payment activity exposes “Manage association”, including inherited activity, to remove the original direct association. Archived records preserve access to existing cost history and removal; adding or moving onto an archived target requires restoration.

Association changes never create or edit financial events, allocations or ledger entries. Refunds and corrections follow the nearest active association already defined by the cost read model. A corrected payment can override its original context; removing that override restores inheritance. Confirmation explains that behavior.

`assign_expense_context` authenticates the household, locks active targets, serializes requests and event association writes, and checks the original opaque revision before changing a link. A trigger regenerates revisions even for existing direct table writes, preventing timestamp collisions and stale confirmation overwrites. An association cannot be repointed to another financial event. Private receipts bind each request to its full payload and acknowledge identical retries without restoring a later changed or removed link. Link updates and receipts commit together. Confirmation retains the same visible details, action, revision and request identity through partner refresh and failed submissions.

The server read layer scopes every query to authenticated membership, limits pages to 30 plus a continuation sentinel, validates both cursor parts before constructing a filter and rejects missing expenses/links. Server actions preserve framework authentication redirects and invalidate the whole cost route subtree after success, so old and new contexts refresh together. No new payment, payment processing, external sharing or production operation is involved.

## Verification

- Full `pnpm verify` passed 395 tests in 65 files, formatting, lint, type checks and production build.
- Eighteen Playwright cases passed across Chromium, WebKit and mobile Safari using a fixture-enabled production build. They cover payment selection, exact amounts, booking/paging destinations, empty states, frozen confirmation through refresh and rejection, removal/inheritance copy, successful return, and the prior paid-cost entry/detail flows.
- Database test 030 adds tenant/anonymous/private-receipt checks, stale/no-link revision rejection, equal partner reassignment, payload-bound replay after later edits, all target kinds, archived/mismatched bookings, immutable event identity, refund/reversal/replacement inheritance, and atomic rollback after a forced receipt failure. Forty randomized reassignment sequences assert exact derived totals, unchanged event count and byte-equivalent ledger rows.
- Local database tests and security advisors were attempted; PostgreSQL at 127.0.0.1:54322 refused the connection. Database execution and actual concurrent sessions remain unverified. CI on the underlying PR currently stops at the missing PR44 attachment helper before these migrations. That dependency integration remains pending authorization; no alternate import was used.
- Evidence: `/tmp/association-final-verify.log`, `/tmp/association-production-e2e.log`, `/tmp/association-fixture-build.log`, `/tmp/association-db.log`, `/tmp/association-advisors.log`.

The earlier PR58 head `b2d1e93` received a Codex thumbs-up on 5 September at 05:35:50 UTC. That approval does not cover this association follow-up. Fresh review is required.
