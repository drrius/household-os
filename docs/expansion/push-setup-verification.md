# Device push setup

The device panel checks the browser subscription against the authenticated member’s exact endpoint and household. Only an active server registration is shown as enabled. Missing or disabled registration offers reconnect; failed reads offer retry. Checking never requests notification permission. Browser subscriptions survive uncertain registration responses so retry can safely reconcile either result.

Tests require an explicit press and use the existing one-minute dispatcher, 50-job drain cap, five delivery attempts and claim leases. A test targets one owned active subscription and carries fixed copy and the notification-settings URL. It creates no Inbox message. The UI reports queued, accepted by the push service, or failed; acceptance is not evidence of display. Status refresh is explicit and bounded. An uncertain enqueue retries the same UUID.

## Database and delivery contract

Migration `20260905003000_device_push_tests.sql` adds an exclusive alternative test source to the existing outbox. The composite household/member/subscription FK prevents foreign recipients and removes a test if its device is deleted. Quota evidence is separate, has RLS and no client table privileges, and survives device/outbox deletion. The enqueue RPC locks the member before the device, serializing a rolling five-per-24-hour member quota across devices and a one-per-minute endpoint quota. A stored endpoint digest preserves that limit when the same endpoint is re-registered with a new subscription ID. Both RPCs authenticate and authorize; request UUID collisions never return another member’s result. Only evidence older than two days is pruned, outside both quota windows.

Outbox readers audited: normal Inbox producers retain their original non-null source; reminder cancellation still cascades only its own Inbox jobs; `claim_push_outbox` keeps its return shape and includes explicit test metadata with a left join; SQL fallback drain checks the exact test device; the Edge worker filters that device and fails closed for a missing target; finalization rejects delivery IDs other than the test device. Ordinary notification payloads, dispatch authentication, leases and retry policy remain unchanged. No other outbox retention or application reader exists on this base.

The Edge helper now uses a small explicit database type for its two RPCs and subscription update, avoiding the SDK’s generic `ReturnType` inference to `never`. Dependencies remain pinned to the existing versions.

## Release setup

Deploy the updated `push-dispatch` Edge function before applying the new migration and releasing the app. The new worker accepts the old ordinary jobs. An old worker does not understand device-test metadata. Use the existing VAPID and dispatcher configuration; no new credentials, service or paid dependency is required. No deployment or live notification was performed during implementation.

## Verification

- `pnpm verify` passes formatting, lint, type checks, 49 test files / 279 tests and the production build. Unit tests cover exact account/endpoint reads, disabled/missing registration, read failures, endpoint/UUID validation, safe RPC status parsing, permission-neutral reconciliation, fixed test payload and unchanged ordinary payloads.
- Two Deno fixture tests pass and check exact target filtering and fail-closed missing targets without network or send permissions. The worker passes Deno type checking.
- Eight browser fixture cases pass and exercise reconnect, pending states, server-error recovery, blocked permission instructions, idempotent lost-response retry, queued/accepted/failed status and device disable on desktop Chromium and mobile Safari.
- Database test021 covers RLS/privileges, foreign endpoints and UUID collisions, no Inbox side effect, exact-target claims/finalization, rolling limits and deletion/re-enrollment protection. Local execution is blocked because the local Supabase database refuses connections at port54322; CI must run this suite before integration.

All delivery validation uses fixture data. Missing live push credentials and unavailable local database prevent claiming an end-to-end real notification delivery test.

## Account-switch reconnect follow-up

The registration command preserves a typed ownership rejection only when the
existing RPC returns SQLSTATE42501 and its exact endpoint-owner message. Other
authentication, permission, and connection errors leave the subscription intact.
After an explicit enable/reconnect press, confirmed ownership rejection releases
only the exact rejected browser endpoint and subscribes once to a fresh endpoint.
A false, rejected, or stalled cleanup returns browser-settings recovery guidance;
it never claims enabled or retries automatically. Lookup and unsubscribe each
have a two-second deadline. Confirmed browser recovery failures retain the
unregistered state without immediately repeating the stalled discovery.

A changed concurrent endpoint is preserved. A lost fresh-registration response
also preserves the new endpoint for reconciliation. No server subscription owned
by another member is unregistered, and no worker or database behavior changes.

- Full `pnpm verify` passes: 51 test files / 293 tests and production build.
- Twenty Chromium/mobile Safari fixture cases pass, including account switching,
  false/rejected/stalled unsubscribe, stalled lookup, recovery on the next explicit
  press, and preservation after an uncertain response.
- Error classification tests distinguish ownership from generic authorization and
  infrastructure failures. No live notification or permission prompt was issued
  by verification tools; no new deployment, migration, or credential is needed.
