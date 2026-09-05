# Money CodeRabbit follow-up

Refund operation identity now belongs to the mounted refund session, seeded by the server and keyed by its original event. Background server refreshes and rejected submissions retain the same operation. A new refund session receives a fresh operation. The session wraps the submission-keyed form contents so validation responses do not reset its identity.

Attachment uploads now show a useful recoverable error when a failed upstream response contains HTML. The user can select the file again and finish the upload.

The negative-share finding was not reproduced. The existing CHF parser accepts only unsigned amounts and already throws a field-specific error. Added example and property tests verify rejection for either member, including negative shares whose sum matches the requested refund, while retaining valid zero shares. No redundant parser check was added.

Verification: `pnpm verify` passed (366 tests, formatting, lint, types and production build). All 30 Money Playwright cases passed across desktop Chromium, desktop Safari and mobile Safari. Tests cover actual server refresh, rejected submission retry, new operation identity, and recovery from HTML 413/503 upload responses. Logs: `/tmp/money-coderabbit-verify.log` and `/tmp/money-coderabbit-e2e.log`.

This follow-up changes no database schema or financial posting command. Existing ledger property tests passed as part of verification. Hosted CI remains required on the pushed head; no unavailable local database run is claimed as passing. The integration branch tracks outstanding dependency assembly and app-wide acceptance work.
