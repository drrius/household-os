# Integrated acceptance checkpoint

Snapshot: September 5, 2026, assembly commit `75bac1b` in [PR #66](https://github.com/drrius/household-os/pull/66). This supersedes the implementation-gap statuses in the [initial audit](app-wide-audit.md), not its acceptance requirements. The goal remains active. The matrix records source and test coverage, not a claim that all acceptance checks passed.

## Required scope and evidence

| Requirement                                                               | Connected implementation and evidence to inspect                                                                                                                | Acceptance still required                                                                            |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Groceries, cart feedback and shopping-to-expense handoff                  | Grocery routes and `src/ui/groceries`; `groceries-workflow`, `groceries-review`, `grocery-quick-add` and `money-workflows` browser specs                        | Current PR #47 browser CI; authenticated shopping → receipt → Money journey                          |
| Today occurrence details, exceptions and completion context               | Occurrence routes, routine commands and `routine-polish.spec.ts`; routine contention database tests                                                             | Two-member completion/exception visibility in the assembled app                                      |
| Meals, recipe/prep, moves and preserved week                              | Meal/library routes; `meal-workflows`, `meal-prep-refresh`, `meal-template-refresh` and `plan-form-navigation` specs                                            | Confirm the complete member journey and latest PR #59 positive review                                |
| Inspectable, correctable and refundable finances                          | Money detail/correct/refund routes; `src/domain/money` example/property tests; financial database tests                                                         | Member-visible corrected balances and original/correction/refund history                             |
| Concise forms, starters, areas and recovery                               | Shared FormFields and discard handling; routine/project starters; `form-shell`, `discard-forms`, `discard-history`, `routine-polish` specs                      | Final assembled mobile/keyboard journey; no lost edits after rejection or navigation                 |
| Trips, flights, stays, itinerary, checklists and away preparation         | Project/booking routes; travel, packing and home-preparation presets in `src/domain/projects/starters.ts`; `trip-bookings` and `project-starters` specs         | Current PR #60 browser CI and trip → booking → task journey                                          |
| Shared projects, assignments and history                                  | Project/task actions, notifications and retained history; `projects` and `project-history` specs                                                                | Partner assignment notification opens the right task and refreshes completed work                    |
| Private calendar and shared iCloud read/write                             | `src/lib/calendar` discovery, transport, queue, conflict and sync; calendar domain recurrence/timezone/export tests; calendar browser specs                     | Latest calendar CI/review; live private-calendar import, bidirectional edit and conflict round-trip  |
| Inventory, maintenance, manuals, receipts, warranties and repair contacts | Home-record routes and relations, private attachments, maintenance routines; `home-records`, `home-collections`, `home-attachment-refresh`, `attachments` specs | Asset → maintenance/contact/document/expense member journey and live authorized file access          |
| Commitments and renewal deadlines                                         | Commitment relations and `src/domain/today/agenda.ts`; deadline/agenda tests                                                                                    | Upcoming notice deadline visible in Today; renewal decisions never auto-post paid money              |
| Decisions and wishlists become work                                       | `decision-controls.tsx` and authenticated conversion commands; decision choice/conversion database tests; `decision-archive.spec.ts`                            | Both members see one resulting project/trip after repeated conversion attempts                       |
| Connected expenses and private documents                                  | Contextual-cost read model and associations; project/booking linked resources; `context-costs`, `expense-associations`, `plan-resources` specs                  | Trip/booking/document/paid-cost navigation and authoritative balance cross-check                     |
| Discoverability, search and exact notifications                           | Five primary destinations, Plan/Home collections, global search, scoped result links and inbox destinations; search/inbox/agenda specs                          | Authenticated search → edit → save → search context and exact partner-notification destination       |
| Account exit and push ownership                                           | Sign-out cleanup and registration reconciliation; `account-flow`, `push-setup` and device ownership tests                                                       | Real-device sign-out/account-switch and installed-iOS delivery                                       |
| Responsive UI, accessibility and motion                                   | Shared shell/forms, responsive feature screens, mobile Safari/Chromium specs and existing screenshots                                                           | Final integrated visual/keyboard/reduced-motion audit; fixtures alone do not prove member data flows |
| Tenant, finance, identity and zero-cost boundaries                        | RLS/database suites, append-only ledger and integer-centime property tests; server authorization; ADRs and release guide                                        | Latest assembled CI; reviewed production configuration only after separate authorization             |

Browser-spec names refer to `tests/e2e/*.spec.ts`. Most expansion browser tests use controlled `/m6-fixture` or `/m7-fixture` surfaces. They prove the tested interactions, not authentication, database persistence or actual partner realtime delivery. In particular, the agenda partner-completion case changes fixture inputs; it is not a two-session realtime test.

## Initial audit disposition

- **A1 — daily obligations:** implemented in the shared agenda with deadline, date/zone, lifecycle and linked-booking logic. Different timed intervals remain separate; only explicitly linked identical intervals coalesce. Partial read failure retains daily activities and offers retry.
- **A2 — discovery/search:** collections and exact results are connected. Search context survives detail/edit/save redirects. Lowercase valid timezone dates and concurrent index creation have new database CI gates.
- **A3 — sign-in destination:** validated internal continuation is implemented and covered by account-flow tests. Live passkey continuation remains separate.
- **A4 — inbox:** pagination, unread filtering, authorized exact destinations and fallback links are implemented. Private push payloads remain generic.
- **A5 — push reconciliation:** registration reconciliation, recovery and explicit delivery testing are implemented. Queued/accepted status is not proof of device receipt.
- **A6 — sign-out:** device exit and subscription cleanup are implemented, including failed-sign-out retries and account-switch ownership protection.
- **A7 — edit protection:** meaningful dirty tracking and supported in-app/history/unload protection are implemented. Successful saves and metadata do not count as unsaved edits. Mobile browser termination cannot promise recovery.
- **A8 — release evidence:** the release/recovery runbook was merged externally in PR #65. Actual production rollout and the four-week replacement trial remain unperformed.

## Remaining acceptance execution

Use the repository verification skill's isolated origin and real member paths, with fixtures disabled. Local Supabase was unavailable during implementation; no production credentials, resets or alternate auth mechanisms were used to manufacture proof.

1. As member A, create a fictional trip, add a flight and stay with distinct local time zones, select travel/packing/home-preparation tasks, and assign one task to member B. Add a linked calendar event and a private confirmation document.
2. Add an explicitly paid CHF expense from the trip context. Inspect it in Money and check the other member's obligation. Edit the booking estimate and confirm that this does not change paid balances. Correct/refund the paid event and verify retained history and derived totals.
3. As member B, open the assignment notification, complete the task and inspect its history. Confirm that A's Today/project view refreshes. Find the booking via search, edit it, and retain search filters after save and return.
4. Exercise simultaneous edits: preserve the later saved version, show a recoverable stale-edit response, keep entered values, and avoid duplicate task/expense creation after retry. Archive/restore the trip and booking separately and verify retained details and blocked edits under an archived parent.
5. Create an asset with warranty/contact/document/maintenance links and a recurring commitment with a cancellation notice deadline. Confirm useful Home/Today links and that these records do not create financial events automatically.
6. Add and check off groceries, complete shopping, record the paid receipt, and open the authoritative Money event from both the receipt and inbox. Check a rejected save and deliberate discard on a phone-sized screen.
7. Verify both members' session expiry, saved deep links, sign-out and device ownership. Inspect keyboard focus, validation announcements, touch targets, overflow and reduced motion on these actual member paths.

Record sanitized actions and resulting UI states, not only final screenshots. Keep personal data, private URLs and credentials out of this public repository. Live iCloud, push, uploads, passkeys and production rollout follow the separate [release guide](../household-release-runbook.md); they remain explicit external acceptance gates.

## Review and CI facts at this checkpoint

- PR #60 `8b76626`: hosted verify and database job [101306027684](https://github.com/drrius/household-os/actions/runs/33965944089/job/101306027684) passed, including restore-only and restore-plus-content rejection. The corresponding PR #67 thread is resolved; browser CI remained running when checked.
- PR #47's status-formatting failure was corrected in `6f1d42c`; its new verify/database jobs passed. The preceding browser job failed before tests because port 54322 was occupied on its hosted runner. The replacement run was already active; no app success was inferred from the infrastructure failure.
- Calendar snapshot recurrence-type validation passed hosted database CI and its thread is resolved. The latest alarm validation has 49 focused tests, lint and domain TypeScript passing; current-head hosted checks remain required.
- CodeRabbit explicitly found no substantiated bug in the scoped assembly changes at `adb7e83` and recurrence resolver at `e50f4a8`. Those statements do not approve later heads or all earlier unreviewed work. Foundation/cost-context reviews were re-requested after rate-limited attempts.
- Search index and lowercase-zone changes, and the latest assembled head, still require current database/browser CI and positive review. Vercel preview rate limits are distinct from GitHub CI; an ignored/canceled preview is not a working deployment.

No PR was merged into main and no production migration or deployment was performed by this task.

## Authenticated CI journey added after the snapshot

`playwright.members.config.ts` and `tests/member-e2e/trip-money.spec.ts` add a separate `member-e2e` CI job with fixture routes disabled. It bootstraps exactly two fictional members through the existing administrator command, signs them in through the product consume-link flow, creates a trip and booking using forms, posts a paid expense, and checks the partner's trip costs and Money obligation through the UI. It refuses non-GitHub execution, nonlocal service URLs and a populated household database. Privileged keys remain in memory/stdin; neither keys nor enrollment links are written to reports. There is no production access or database reset.

Targeted lint and TypeScript passed before the first push. Runtime execution is pending hosted CI. This journey does not prove real passkey authentication, realtime delivery, attachments or live iCloud; those retain their separate acceptance gates.
