# Sign-out notification privacy

Codex finding 3939651901 identified that failed or stalled browser discovery could leave an enabled push endpoint after local sign-out. Unknown endpoint discovery now invokes `pause_my_push_for_signout` before ending the authenticated session. The command pauses all active subscriptions belonging to the authenticated member, checks household membership, and does not modify a partner or foreign household. Already-disabled timestamps are preserved. Any cleanup error keeps sign-out incomplete and retryable.

Known endpoints still use the existing device-only unregister command. The fallback can pause the member's other devices; the security screen explains this before signing out, and successful fallback redirects to a sign-in status explaining how to reconnect each device in Home → Notifications. Other auth sessions and passkeys stay available. Browser discovery remains bounded to 500ms; browser unsubscribe remains best effort after successful server cleanup and sign-out.

Validation: `pnpm verify` passed 387 tests in 59 files and production build. A fixture-enabled production build passed all 63 account/foundation browser cases across Chromium, WebKit and mobile Safari. Rejected and stalled registration/subscription discovery now exercise the fallback result and visible reconnection explanation. Unit tests verify command ordering, local auth scope and cleanup failure behavior. Database test 031 checks permissions, member/tenant isolation, retry behavior, preserved identity/keys/timestamps and one-device reconnection. `pnpm db:test` was attempted but local PostgreSQL refused connection on port54322; these SQL assertions are not claimed as executed locally. Hosted database verification remains required.

Evidence: `/tmp/signout-fallback-verify.log`, `/tmp/signout-fallback-fixture-build.log`, `/tmp/signout-fallback-e2e.log`, `/tmp/signout-fallback-db.log`.

## Retry notices and endpoint ownership

Findings 3939705313 and 3939705315 are addressed. The fallback reports the member's total paused subscriptions separately from rows changed this attempt, so a retry after an authentication failure retains the reconnection notice. Server sign-out only authorizes browser unsubscribe when the existing ownership-scoped unregister command confirms a matching row. A surviving partner-owned endpoint is left alone.

Full verification passes 389 tests/build. All 66 account/foundation production browser cases pass, including partner-owned subscriptions and existing discovery/unsubscribe failures. SQL031 adds retry-notice and foreign endpoint assertions; local database execution remains unavailable. The previous SQL031 revision passed hosted CI, while the overall suite failed at the pre-existing meal/routine dependency mismatch.

Finding3939705306 remains an integration gate: reviewed PR56 already reconciles browser subscriptions with active server registration and exposes Reconnect for paused rows. That branch is not integrated here, and the combined sign-out/reconnection flow has not been verified. The pending branch-integration authorization must be resolved before this finding can close.

Evidence: `/tmp/signout-ownership-verify.log`, `/tmp/signout-ownership-fixture-build.log`, `/tmp/signout-ownership-e2e.log`, `/tmp/signout-ownership-db.log`.
