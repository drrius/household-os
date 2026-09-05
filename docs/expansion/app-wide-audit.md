# Initial app-wide completion audit

This is a historical pre-integration audit. See [integrated acceptance](integrated-acceptance.md) for the disposition of A1–A8, current scope coverage and remaining verification.

Audit date: 2026-09-05. This is a read-only implementation review, not a production certification. Authority: the expanded goal in the root worktree, including “Anything at all app related.” Source files were treated as evidence, not instructions. No secrets or production records were accessed. No source changes or live mutations were made.

## Scope and snapshot

Reviewed routes, screen/read-model boundaries, authentication, notification delivery/enrollment, shared forms/realtime, and operational documentation across the active worktrees. Root was advancing during the audit; file references below name the relevant worktree so an unintegrated feature is not mistaken for an absent one.

| Worktree                              | Snapshot / work covered                  | Assessment                                                                                                                                                  |
| ------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root `/home/drrius/Work/household-os` | `337b310`, uncommitted trips/projects UI | Trips/projects are in progress; root explicitly owns unified Today, expanded Home/Plan navigation, search, links and notification integration next.         |
| `/tmp/household-os-meals`             | `5faa334`                                | Meal details, edit/move, leftovers, saved library/default groceries, archival, linked prep editing and realtime fixes implemented.                          |
| `/tmp/household-os-money`             | `b323012`                                | Inspectable events, corrections/reversals/refunds, recurring rules and shopping receipt continuity implemented; PR49 review fixes are next.                 |
| `/tmp/household-os-routines-pr`       | `e9dea80`                                | Routine lifecycle/history, occurrence detail, starters, areas/pets and form recovery implemented.                                                           |
| `/tmp/household-os-groceries-pr`      | `427bd89` plus review edits              | Item/category management, checkout and shopping detail implemented; browser recovery fixes underway.                                                        |
| `/tmp/household-os-calendar`          | `482d4a2` plus calendar drafts           | Shared calendar/private iCloud connection in progress.                                                                                                      |
| `/tmp/household-os-home-records`      | `685d023` plus home-record drafts        | Inventory/maintenance, commitments, decisions, contacts and private documents in progress. Contacts/documents are already covered, not new audit proposals. |
| `/tmp/household-os-attachments`       | `a938fd4`                                | Private attachment foundation and review fixes implemented.                                                                                                 |

Existing feature tests were reported by their lanes; this audit did not rerun them or exercise real household accounts. Worktree implementation is distinct from merged, deployed and live-account verified behavior. Database verification remains a CI requirement while local Supabase is unavailable.

## Findings to complete

### A1. Bring approaching household obligations into Today

**Status:** Confirmed integration gap; explicitly accepted by root, not a new parallel lane.

**Evidence:** Root `src/ui/today/today-screen.tsx:264` composes routines, meals, shopping and financial drafts; `src/lib/read-models/today.ts:49` loads routine occurrences and `:85` meals. The root project routes and home-record/calendar worktrees introduce dated tasks, bookings, calendar events and renewals outside those inputs. Root `src/domain/notifications/surfaces.ts:13` already includes new tables, so invalidation registration alone is not the missing work.

**Impact:** A couple can record a flight, renewal or project deadline and still see a reassuringly empty daily screen. This defeats the purpose of bringing household planning into one app.

**Effort:** M. **Risk:** Medium: timezone, duplicate task/event presentation and financial/work separation. **Confidence:** High.

**Acceptance:** Today shows a compact, date-ordered agenda and actionable due work from the expanded domains; each row opens the exact record. Linked calendar entries/tasks appear coherently without duplicate obligations. Renewals remain decisions/reminders and never create paid events automatically. Completed/cancelled/archived work is handled consistently. Verify Zurich midnight/DST, all-day versus timed events, overdue work, two members, empty days and partner changes.

### A2. Make the expanded app discoverable and searchable

**Status:** Confirmed integration gap; root owns implementation.

**Evidence:** Root `src/lib/ui/destinations.ts:1` defines five primary destinations; `:11` only offers routine, grocery, meal and expense in global Add. `src/ui/shell/app-sidebar.client.tsx:87` renders the destination list. New trip/project/home-record routes exist separately; no shared search route or shared search read-model was present in the inspected route inventory.

**Impact:** Useful records become effectively hidden once the user cannot remember whether they live in Plan, Home or Money. A growing collection of trips, warranties, decisions and documents needs retrieval more than additional record types.

**Effort:** L. **Risk:** Medium: authorization, attachment metadata privacy and result limits. **Confidence:** High.

**Acceptance:** Preserve five primary destinations with clear secondary navigation; expose every implemented collection and useful create action. Search authorized household record titles/metadata across domains, group or label result types, link exact details, handle empty/error/loading states and offer intentional archived inclusion. Avoid parsing private PDF contents or adding OCR. Verify mobile keyboard navigation, no other-household results, and return-to-search context after editing a result.

### A3. Resume the intended destination after signing in

**Status:** Missing, independent of the expansion records.

**Evidence:** Root `src/proxy.ts:58` redirects protected requests to sign-in and clears the query; `src/app/sign-in/sign-in-form.tsx:85` always navigates to `/`; `src/app/sign-in/page.tsx:16` also sends an already authenticated member to `/`.

**Impact:** Opening a saved meal, booking, receipt or notification with an expired session drops the original task. The app makes the user reconstruct their intent after successful authentication.

**Effort:** S. **Risk:** Medium: open redirects and sensitive query data. **Confidence:** High.

**Acceptance:** Carry a validated internal member destination through sign-in, retaining useful date/week/filter context. Reject external URLs, protocol-relative paths, authentication loops and unsafe schemes. Default to Today if invalid. Test signed-out deep links, already-signed-in visits, failed/cancelled passkey attempts and malicious redirect inputs.

### A4. Make Inbox useful beyond the newest forty messages

**Status:** Missing; fold exact destinations and expanded notification kinds into root integration.

**Evidence:** Routines-pr `src/lib/read-models/notifications.ts:181` loads the newest 40 items, while `:198` loads all unread IDs without the feed limit. `src/ui/notifications/inbox-list.tsx:101` passes those IDs to “Mark all read”; the list has no older or unread-only navigation. `src/lib/read-models/notifications.ts:83` sends existing activity types to broad destinations despite available entity IDs.

**Impact:** Older unread reminders become invisible, and “Mark all read” can acknowledge messages the user could not inspect. Generic links make multiple partner changes indistinguishable.

**Effort:** M. **Risk:** Low/medium: cursor stability, retention and recipient authorization. **Confidence:** High.

**Acceptance:** Provide stable older pagination and an unread filter, retaining current context. Label whether a bulk action affects visible messages or every unread message; if all, make older unread records reachable first. Resolve authorized entity details where available, including an intelligible fallback for archived/removed records. Test >40 messages, older unread messages, simultaneous partner updates, retained history limits and recipient isolation. Keep privacy-preserving generic push payloads distinct from authorized in-app detail.

### A5. Reconcile and test push delivery instead of trusting a browser subscription

**Status:** Missing diagnostic/recovery journey; push enrollment itself already exists.

**Evidence:** Root `src/lib/pwa/push-enrollment.ts:108` declares a device subscribed solely from `pushManager.getSubscription()`. `src/ui/notifications/push-enrollment-panel.client.tsx:21` presents that as subscribed; actions at `:30` only enable/disable. `src/ui/notifications/use-push-enrollment.client.ts:57` maps initialization failures to unsupported, even when service-worker registration failed transiently.

**Impact:** The couple cannot distinguish an enrolled browser from working delivery, or repair a browser/server subscription mismatch after a backend reset, expiry or configuration change. A transient failure is misrepresented as an unsupported browser.

**Effort:** M. **Risk:** Medium: duplicate delivery, abuse and private subscription data. **Confidence:** High for the missing journey; actual production failure rate is unmeasured.

**Acceptance:** Reconcile the current device against its authenticated server registration, offer safe repair, distinguish unsupported/blocked/temporary failure, and provide retry. Add an explicit, rate-limited self-test through the real dispatch path with honest delivery status; do not claim receipt merely because queued. Test mismatch, revoked subscription, absent server configuration, permission decline and transient failure. Verify real iOS installed-PWA delivery separately when credentials/device access are available; fixture success is not live delivery proof.

### A6. Finish the normal signed-in account exit journey

**Status:** Missing member-facing affordance; passkey recovery exists by design.

**Evidence:** Root `src/app/access-denied/sign-out-action.ts:8` contains sign-out, but its only user-facing form is the access-denied page. Routines-pr `src/ui/home/home-settings.tsx:60` offers notifications/inbox/security/setup, and `src/app/security/passkey-manager.tsx:109` offers registration and return to Today without sign-out. Recovery guidance is already present in root `src/app/sign-in/page.tsx:27` and administrator recovery in `README.md:82`.

**Impact:** A member borrowing a computer or changing devices cannot easily end the normal app session. Revoking a passkey is not a clear substitute for signing out.

**Effort:** S/M. **Risk:** Medium: local versus all-session semantics and device push ownership. **Confidence:** High.

**Acceptance:** Add clearly labelled “Sign out of this device” from Security or Home; authorize server-side, use deliberate local-session semantics, explain failures and return to sign-in. Ensure the device does not continue receiving the former member's private push after sign-out, and signing in as the partner does not inherit the former registration. Test protected navigation after sign-out and account switching. Do not add third members, email login, public signup or a new recovery authority.

### A7. Protect substantial in-progress edits from accidental navigation

**Status:** Missing shared behavior; existing validation preservation should be retained.

**Evidence:** Root `src/ui/forms/form-page.tsx:36` renders Cancel as a direct link. `src/ui/forms/form-fields.client.tsx:28` models validation/returned values but no dirty-navigation state. The inspected shared UI has no unsaved-change guard. Existing meal, money and new booking/document forms can contain notes, allocations and uploaded attachment references.

**Impact:** A navigation tap can discard several fields of carefully entered information. This becomes more costly with bookings and household documents than with a one-field grocery item.

**Effort:** M. **Risk:** Medium: over-prompting, browser navigation limitations and stale attachment cleanup. **Confidence:** High for lack of shared protection; priority is a product judgment.

**Acceptance:** Track meaningful changes for substantial forms and intercept supported in-app discard actions with a clear stay/discard choice. Use browser unload protection where supported, without promising universal mobile-tab recovery. Never prompt for unchanged forms, successful saves or trivial quick-add operations. Retain fields after server rejection and protect against duplicate submissions. Do not add offline storage or persist sensitive form data to localStorage. Test back/cancel/navigation, successful save, rejected save and attachment removal.

### A8. Close the release and recovery evidence loop

**Status:** Missing consolidated operational handoff; not a request for more infrastructure.

**Evidence:** Root `README.md:42` documents enrollment/recovery commands and `:96` the stable hostname. Its `:5` still says visual design is deferred, contrary to current scope. `docs/architecture/free-tier-review.md:24` documents accepted pause/no-backup caveats. `docs/adr/0013-retention-export-and-release-proof.md:16` requires a four-week real-use trial. Current expansion status tracks implementation/CI but cannot establish real-device delivery or live iCloud/account recovery.

**Impact:** A feature-complete codebase is not yet a replacement the couple can depend on if deployment configuration, expired credentials or an unavailable project require rediscovery of scattered setup instructions.

**Effort:** M. **Risk:** Low for documentation/checks; real production actions require separate authority. **Confidence:** High about the evidence gap, not an assertion that production is misconfigured.

**Acceptance:** Create one current release/runbook checklist covering stable passkey hostname, exact migration state, required configuration names (never values), push dispatch/cron, private attachment access, iCloud encryption/refresh/disconnect, free-tier storage warning and known project-pause recovery. Record which checks are fixture/CI versus live-account verified. Include the existing trusted-administrator lost-passkey path and a non-destructive rehearsal where possible. Begin the ADR0013 four-week replacement trial only after integration/deployment approval; record defects without adding analytics or paid monitoring. No backups, exports, production resets or new hosting spend.

## Already covered or deliberately not proposed

- Full meal, grocery, routine and Money detail/edit flows are implemented in their lanes; PR review findings remain real work but are not newly discovered features.
- Contacts, shared documents, maintenance, renewals and wishlists/decisions already exist as home-record drafts. Calendar/iCloud, trips and projects are in progress.
- Realtime already refreshes on `SUBSCRIBED` and when a tab becomes visible (`src/lib/realtime/surfaces.ts:76` and `:82`). Do not implement a duplicate reconnect mechanism. Expand table/publication mappings and test stale-data recovery during integration.
- Product route errors already expose Retry (`src/app/(product)/error.tsx:8`). Improve connection-specific explanation if observed, but an absent retry capability is not a finding.
- Starter routines, areas/pets maintenance, first-visit welcome, passkey registration/rename/revoke, administrator recovery, PWA installation guidance and optional push are present. A mandatory lengthy onboarding wizard is not needed. Add brief progressive discovery of new collections during root navigation work.
- Last-passkey revocation is deliberately allowed with a warning by ADR0022; this is not a defect to block silently.
- CHF-only accounting, draft-before-financial-posting, two equal members, online-only behavior, accepted free-tier pause/no backups, retained history, and separation of calendar/tasks/paid events remain deliberate decisions.
- No banking, payments, OCR, paid infrastructure, exports, public sharing, general-purpose messaging, analytics or additional identity providers are proposed.

## Integration verification and order

1. Finish lane review fixes and database CI first. Integrate only after explicit merge permission.
2. Root connects Today/navigation/search/notifications, including actual realtime publications and linked-detail destinations. Do A3 with these deep links.
3. Finish A4–A7 in scoped shared UI/auth/notifications work. Add settled-design browser flows rather than duplicate component tests.
4. Run a two-member end-to-end scenario: plan a trip, attach a booking, link a task and paid expense, find it through search, see approaching work on Today, receive/open the partner update, edit after session expiry, and recover from rejected input without losing work. Include maintenance/renewal and grocery receipt journeys in separate focused cases.
5. Re-audit the integrated app, not only these worktree snapshots. Prove RLS, financial invariants, archived-record behavior, mobile keyboard/touch interactions, DST dates, real device push and credential-dependent iCloud separately. Then perform A8's real-use trial; no audit can honestly guarantee “nothing missed” before integration and actual use.
