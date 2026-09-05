# Sign-out notification privacy

Unknown browser push discovery invokes `pause_my_push_for_signout` before ending the authenticated session. The command pauses active subscriptions belonging to the authenticated member, verifies household membership, and leaves partner and foreign-household rows unchanged. Already-disabled timestamps are preserved. Cleanup failure leaves sign-out incomplete and retryable.

Known endpoints use the existing ownership-scoped unregister command. Browser unsubscribe is authorized only when that command confirms a changed owned row. A surviving partner-owned endpoint is left alone. Discovery is bounded to 500 ms; browser unsubscribe is best-effort after server cleanup and local sign-out. The security screen explains the fallback before signing out, and the resulting sign-in notice explains reconnection through Home → Notifications. Other auth sessions and passkeys remain available.

## Retry notices

The fallback reports only rows changed in the current request. Historical disabled subscriptions cannot produce a new pause notice. If notifications are paused but authentication sign-out fails, the action returns that fact with the error. The mounted control remembers it across retries, including a retry that discovers a known endpoint or changes no rows, and preserves the reconnection notice after success. This state is scoped to the current control; reloads and lost responses do not establish persisted notice history.

This replaces the earlier total-paused-count approach. It addresses findings 3939752777 and 3939752781 without treating old disabled devices as new side effects.

## Passkey loading

Security still authorizes membership on the server. Listing passkeys runs independently in a client component so a failed or stalled request cannot prevent sign-out from rendering. Failed listing offers an explicit retry; it is never represented as an empty successful list. Sign-out becomes enabled after hydration. Browser cases cover failed and pending listing, real sign-out action authorization, and successful retry of listing. This addresses finding 3939752782.

## Verification and limits

Full `pnpm verify` passes 389 tests and the production build. The fixture-enabled production build includes the updated loading and recovery cases. Database test031 covers permissions, member/tenant isolation, retry behavior, historical timestamps, endpoint ownership and one-device reconnection. Local `pnpm db:test` was attempted but PostgreSQL refused port54322; the current SQL revision requires hosted execution. SQL031 at the previous head dd40422 passed hosted CI, while the overall suite failed at the pre-existing meal/routine dependency mismatch.

The first browser run passed 76 of 78 cases. Two desktop WebKit cases stalled inside native `PushManager.getSubscription()` before the server action request. A diagnostic wrapper recorded entry into that native method without a return; blocking service-worker registration allowed the same real action to navigate successfully. The passkey-loading group therefore blocks native service workers in the test harness. All 78 account/foundation/recovery cases pass with this isolation across Chromium, WebKit and mobile Safari. Separate cases retain controlled rejected/stalled discovery and subscription behavior. This is not proof of live Safari push-service behavior.

Finding3939705306 remains an integration gate: reviewed PR56 already reconciles browser subscriptions with active server registration and exposes Reconnect for paused rows. That branch is not integrated here, and the combined sign-out/reconnection flow has not been verified. The pending branch-integration authorization must be resolved before this finding can close.

Evidence: `/tmp/signout-recovery-verify-final.log`, `/tmp/signout-recovery-fixture-build-final.log`, `/tmp/signout-recovery-e2e-final.log`, `/tmp/signout-recovery-e2e-isolated-runtime.log`, `/tmp/debug-signout-webkit-discovery.log`, `/tmp/debug-signout-webkit-block.log`, `/tmp/signout-recovery-db.log`.
