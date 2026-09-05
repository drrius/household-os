# Implementation status

Effective goal: [goal.md](goal.md). Scope includes the whole app and additional worthwhile functionality discovered during implementation.

Base: latest main `39f9363`, including the assistant and recurrence fixes. Existing PR #40 (MCP bridge) is not owned by this effort.

| Slice                                                        | Owner / branch                          | State                                              | PR / review |
| ------------------------------------------------------------ | --------------------------------------- | -------------------------------------------------- | ----------- |
| Product decision, private attachments                        | integration / codex/household-expansion | Implementing; unit/API coverage; RLS tests written | Pending     |
| Meals: details, week context, move, library, leftovers, prep | meals / codex/meals-complete            | Implementing                                       | Pending     |
| Groceries: quick entry, editing, checkout, history           | groceries / codex/groceries-complete    | Implementing                                       | Pending     |
| Routines, Today, onboarding, home maintenance controls       | routines / codex/routines-complete      | Implementing                                       | Pending     |
| Money detail/correction/refund and recurring rules           | integration next lane                   | Planned                                            | Pending     |
| Trips and projects with linked work and paid expenses        | integration                             | Schema/design next                                 | Pending     |
| Shared calendar and private iCloud sync                      | integration                             | Planned                                            | Pending     |
| Inventory, commitments, decisions/wishlists                  | integration                             | Planned                                            | Pending     |
| App-wide completeness and UX/accessibility audit             | integration                             | Continuous; final independent pass required        | Pending     |

## Verification

- Latest-main baseline: `pnpm --config.verify-deps-before-run=false verify` passed (55 test files, 339 tests plus format/lint/type/build).
- Local pnpm requires `--config.verify-deps-before-run=false` to avoid its implicit install path in this environment. Dependencies installed from frozen lockfile.
- Local Docker socket is inaccessible even outside the sandbox; passwordless sudo is unavailable, and localhost PostgreSQL port 54322 has no listener. Database verification alternative is being investigated. No production database commands have been run.
- Live iCloud account credentials have not been supplied. Sync implementation can be verified against controlled CalDAV fixtures; live-account setup remains separate.

## Additional gaps discovered

- No private attachment upload foundation despite receipt/photo fields in existing domain commands. Implementing before dependent UI.
- Empty active shopping sessions cannot be ended. Add explicit cancel-session command with safe claim release.
- Latest main contains approved assistant scope exceptions (ADR 0027); preserve those, introduce no new paid infrastructure.
