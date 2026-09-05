# Household release and recovery guide

Use this guide for an authorized release of an assembled, reviewed app. Opening or merging a feature PR is not proof that its database, worker and app versions are deployed together. This guide does not authorize deployment, account recovery, changes to the household's calendar or a data reset.

The repository is public. Keep credentials, enrollment links, private calendar addresses, household screenshots and real-use notes outside it. Record only sanitized evidence and commit/CI references here.

## Release record

Before starting, record the deployment commit, approved migration set, required worker versions, CI links, reviewer outcome and operator approval in the private release record. Mark a check **pending**, **fixture/CI passed**, or **live passed**; include its date and tested commit. Never promote a fixture result to a live result.

| Check               | Evidence required before calling it live                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Passkeys            | Both members sign in on the stable hostname; a saved deep link survives sign-in                                              |
| Database            | Applied migration history matches the reviewed release; RLS and financial checks pass in CI                                  |
| Attachments         | Both members can open an authorized receipt; another household cannot; abandoned uploads are reclaimed                       |
| Push                | Each intended device receives the explicit test and opens the app; queued or push-service acceptance alone is insufficient   |
| iCloud              | The selected shared calendar imports; a harmless test event round-trips in both directions; conflicts preserve both versions |
| Household workflows | Trip/task/paid-expense links, groceries/receipt handoff, routine completion and renewal decisions work together              |
| Replacement trial   | Four consecutive weeks satisfy [ADR 0013](adr/0013-retention-export-and-release-proof.md)                                    |

Current implementation evidence lives in the feature PRs and `docs/expansion`. Live iCloud, real-device push, production recovery and the replacement trial have not been established by these implementation checks.

## Configuration locations

Verify names and presence without printing values. Keep the selected Vercel Hobby/Supabase Free architecture and the CHF 0 operating-cost boundary; inspect current provider usage before changing limits or enabling an add-on.

| Location                                  | Configuration                                                                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js app                               | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                                                                                       |
| App push enrollment                       | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, matching the worker's public key                                                                                         |
| Calendar server, when PR #50 is assembled | `HOUSEHOLD_CALENDAR_ENCRYPTION_KEY`: canonical base64 for 32 random bytes; retain the same key across deployments                                        |
| Passkey deployment check                  | `HOUSEHOLD_OS_WEBAUTHN_RP_ID`: the stable bare hostname; configure the matching production Auth RP ID and allowed origin                                 |
| Push Edge Function                        | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; Supabase supplies its server connection credentials                                            |
| Supabase Vault                            | `push_dispatch_url` and `push_dispatch_secret_key`; the existing legacy fallback is `push_dispatch_service_role_key`                                     |
| Attachment Edge Function                  | Supabase-injected `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; no privileged credential belongs in Next.js or browser configuration |

The push worker accepts the platform's configured secret-key formats and authenticates its own `apikey` request. Its repository configuration uses `verify_jwt = false`. Preserve that worker-specific setup; the attachment worker retains gateway JWT verification and independently verifies the member's JWT. Do not apply one worker's authentication setting to the other.

## Deployment order

Use a release checkout containing all required dependency changes. Keep experimental branch schemas away from the production project. Run focused local checks according to [AGENTS.md](../AGENTS.md); use hosted CI for the full suite, database tests and relevant browser coverage. Require results and review for the commit being released.

1. Verify the stable hostname and both members' existing enrollment. `pnpm check:webauthn` validates repository configuration; it does not prove hosted Auth is configured. Changing the RP ID after enrollment can strand existing passkeys.
2. Review the linked project's pending migration set with `pnpm exec supabase db push --linked --dry-run`. This is the entire checkout's pending set. Stop if it contains an unexpected migration; never rewrite an already applied migration.
3. If deploying device-push tests, deploy the compatible updated `push-dispatch` worker **before** applying that feature's migration. It accepts existing ordinary jobs; the old worker cannot interpret the new device-test source. See [push setup](expansion/push-setup-verification.md).
4. Apply the reviewed migration set with `pnpm exec supabase db push --linked`, using the approved release procedure. Record the resulting migration history without credentials.
5. Deploy `household-attachment-upload` **after** its registry, claims and Storage trigger exist. See the [attachment release guide](attachment-upload-setup.md). Confirm its configuration before enabling uploads in the app.
6. Deploy the matching app, then perform the two-member live checks in the release record. Calendar, project and other feature migrations must be assembled before their app routes are enabled. Do not treat an app rollback as permission to remove migrations or financial history; use an appropriate forward fix or a compatible app version.

No deployment commands in this guide were run while writing it.

## Scheduled work and push diagnosis

Cron installation blocks in migrations tolerate unavailable extensions, so migration success alone does not establish scheduling. In an authorized administrative database session, inspect job names and status without selecting secret values:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname like 'household-os-%'
order by jobname;

select jobid, status, start_time, end_time
from cron.job_run_details
order by start_time desc
limit 20;
```

Compare with the installed migration definitions: due reminders, member digests, occurrence maintenance, recurring drafts, activity retention, grocery retention and push dispatch must be present as applicable. Household date decisions use Europe/Zurich; do not infer local execution times from a raw cron expression.

For push, first use the app's device status: check enrollment, reconnect an unregistered device, then press its explicit test button. If queued work does not progress, inspect recent cron/worker failures and confirm the Vault URL and dispatcher credential are configured. If the push service accepts the message but it is not displayed, check that device's notification permission and installation state. Confirm actual delivery on each member's intended device. Successful sign-out must remove that member's server registration; account switching must reconcile the surviving browser subscription.

## Connect and recover the shared iCloud calendar

This section applies after [PR #50](https://github.com/drrius/household-os/pull/50) and its dependencies are assembled. The current implementation synchronizes through the explicit Sync action; it does not establish unattended calendar polling.

1. Set the server encryption key once, then use the app's calendar connection screen with the Apple Account email and an app-specific password. Apple requires two-factor authentication to create these passwords; use its [current instructions](https://support.apple.com/en-us/102654).
2. Select the existing shared calendar by its displayed identity. Verify a known ordinary event, its zone and any all-day date before changing anything. Do not use a public calendar feed as a credential workaround.
3. With the household's approval, round-trip a clearly labelled disposable event in each direction. Check a concurrent edit/conflict and verify neither member's version is silently overwritten. Use an ordinary event without invitees for this check.
4. For an authentication failure, replace a revoked app-specific password through the connection screen. If stored credentials cannot be unlocked, check that the original server encryption key is still configured; do not keep generating new keys on redeploy.
5. Disconnect waits for active synchronization, removes the saved connection and detaches imported events into local records. It keeps those events and pending local changes and leaves Apple Calendar untouched. Revoke the old app-specific password separately in Apple Account when it is no longer needed.

The implementation and controlled CalDAV tests are in PR #50. Only a completed live check with the selected household calendar establishes live synchronization.

## Storage, outages and account recovery

Home displays household attachment usage and warns at 500 MB. That is an application warning, not a measurement of the provider's remaining allowance. An unavailable usage reading is not zero. Files have a separate 4 MiB limit; completed financial receipts and linked records must remain available. Failed uploads should offer recovery without granting browser Storage INSERT or exposing a privileged key.

For a service outage, preserve the current app state, check provider status and retry after recovery. Supabase may pause an inactive Free project; its dashboard supports resuming a paused project. See the [current availability guidance](https://supabase.com/docs/guides/deployment/going-into-prod#availability). A pause does not call for `db reset`, re-bootstrapping existing members, exports or a new paid service.

If a member loses all usable passkeys, use the existing trusted administrator's `recover-link` procedure in [Identity administration](../README.md#identity-administration). Confirm the intended project, stable app origin and existing member before issuing the private one-time link. Keep the administrator secret on stdin from its trusted source. Rehearse the process with a disposable local/staging member before a live recovery; do not revoke a real member's working passkeys just to test it.

## Four-week replacement trial

Start only after the assembled release and live checks are approved. Privately record the release commit and trial start date, then review each week with both members: recurring care represented, meals/groceries coordinated, financial history and balances understandable, and no new Splitwise expenses. Keep concrete defects and reproduction steps rather than adding analytics.

A critical synchronization error or unreproducible balance restarts the trial, as ADR 0013 specifies. Correct financial mistakes through visible reversal/replacement events. General activity is retained for 90 days and purchased groceries for 30 days; financial events and routine completions remain for the household's lifetime. The accepted product has no application-managed backup/export or guaranteed restoration process. A passing CI badge cannot replace the trial.
