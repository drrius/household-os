# Implementation status

Effective goal: [goal.md](goal.md). The named workflows are a minimum: scope includes the whole app and worthwhile functionality discovered during implementation.

Base: latest main `39f9363`, including the assistant and recurrence fixes. Existing PR #40 (MCP bridge) is not owned by this effort. No PR has been merged and no production migration has been run.

| Slice                                                                     | Branch                    | State                                                                                                                  | PR / review                                                               |
| ------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Product decision and private attachments                                  | codex/household-expansion | Implemented; first fixes pass database CI at `a938fd4`; next review fixes underway                                     | [#44](https://github.com/drrius/household-os/pull/44)                     |
| Meals, library, leftovers, linked prep                                    | codex/meals-complete      | Five findings fixed in `5faa334`; 362 unit tests/build and 18 browser checks pass; database CI pending                 | [#45](https://github.com/drrius/household-os/pull/45), rereview requested |
| Routines, occurrences, setup and areas                                    | codex/routines-household  | Six findings fixed in `e9dea80`; 366 tests/build and 6 browser checks pass                                             | [#46](https://github.com/drrius/household-os/pull/46), rereview requested |
| Groceries, checkout, history and categories                               | codex/groceries-household | Findings fixed in `427bd89`; form-label follow-up `2653cbc` passes verify and both recovery browser checks             | [#47](https://github.com/drrius/household-os/pull/47), rereview requested |
| Connected household schema                                                | codex/connected-household | Foundation implemented; database CI passes at `5371f6c`; additional integrity fixes and cost read model underway       | [#48](https://github.com/drrius/household-os/pull/48)                     |
| Money detail, corrections, refunds and recurring rules                    | codex/money-complete      | Implemented in `b323012`; four review findings being resolved, including opening-balance correction and legacy refunds | [#49](https://github.com/drrius/household-os/pull/49)                     |
| Shared calendar and private iCloud                                        | codex/calendar-icloud     | Implemented in `f23e524`; 382 tests/build and 9 browser flows pass; database/live-account verification pending         | [#50](https://github.com/drrius/household-os/pull/50), review requested   |
| Projects and trip containers with task lifecycle                          | codex/trips-projects      | Core implemented; 364 tests/build and 9 browser cases pass; final cleanup and PR preparation                           | Pending                                                                   |
| Trip bookings, itinerary, checklist starters, paid expenses and documents | integration               | Required follow-up; shared records and calendar capabilities exist, connecting journeys remains                        | Pending                                                                   |
| Inventory, maintenance, contacts, commitments, decisions and documents    | codex/home-records        | Implemented; verification in progress                                                                                  | Pending                                                                   |
| App-wide completeness and UX audit                                        | integration               | First independent audit recorded in meals branch; required follow-ups below and final audit still open                 | Pending                                                                   |

## Verification and external dependencies

- Use `pnpm --config.verify-deps-before-run=false` in this environment. Exact dependencies and the lockfile are committed.
- Local Docker access is unavailable and PostgreSQL port 54322 has no listener. Database validation runs in GitHub CI. Do not equate local unit/browser checks with database proof.
- Early dependent CI runs encountered the attachment migration CASE syntax error; `a938fd4` fixes it. Inspect newer runs before assigning failures to dependent features.
- Live iCloud credentials are unavailable. Controlled CalDAV fixtures verify implementation behavior; the member must configure the server encryption key and an Apple app-specific password for live verification.
- Automatic approval review rejected task-feature-branch integration twice. An explicit user authorization question is pending. Do not import the rejected commits through another mechanism. Independent implementation, same-branch fixes, pushes and PR review continue. The shared calendar date helper `482d4a2` and other dependent branch changes are not yet integrated into the root trip branch.
- Every PR still requires explicit positive Codex review after its final fixes. Missing feedback and service limits do not count as approval.

## Required app-wide follow-ups

- Connect calendar, trips, projects, commitments and maintenance into Today and the existing five-destination navigation.
- Add household-wide search and useful direct links between related records.
- Preserve protected destinations through sign-in; expose normal sign-out.
- Make older and unread inbox notifications reachable and improve their exact destinations.
- Reconcile browser push subscription state with the server and support a personal delivery test.
- Protect substantial unsaved forms from accidental navigation without obstructing successful saves.
- Complete cross-domain notification/realtime coverage, documentation, setup/recovery evidence and a fresh whole-app audit.
- Resolve remaining Codex findings and verify all dependent migrations together before declaring completion.
