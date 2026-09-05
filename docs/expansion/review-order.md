# Expansion PR review order

Snapshot: September 5, 2026. Main is `700cf39`. No PR was merged or production change deployed by this task. A passing check does not establish live iCloud, push, passkey-device or private-upload acceptance.

## Ready against main

These PRs have passing required GitHub CI, explicit positive CodeRabbit review of their changes, and no unresolved review threads.

| PR                                                   | Purpose                                      | Head      |
| ---------------------------------------------------- | -------------------------------------------- | --------- |
| [47](https://github.com/drrius/household-os/pull/47) | Groceries, checkout and purchase history     | `7d7e335` |
| [48](https://github.com/drrius/household-os/pull/48) | Connected household schema and authorization | `29a21df` |
| [53](https://github.com/drrius/household-os/pull/53) | Sign-in destinations and device sign-out     | `8b38824` |
| [57](https://github.com/drrius/household-os/pull/57) | Form navigation and unsaved-edit protection  | `6b2284b` |
| [59](https://github.com/drrius/household-os/pull/59) | Concurrent meal edits and leftover dates     | `99f0eda` |
| [69](https://github.com/drrius/household-os/pull/69) | Realtime channel replacement lifecycle race  | `1505126` |

PR69 fixes a reproduced lifecycle race. The assembled two-member test still reports stale partner state, so it does not establish complete realtime acceptance.

## Reviewed dependent changes

These also have passing required CI and positive review. Their current bases are feature branches. Before merging a child into main, land its dependencies and retarget it to main if GitHub has not done so automatically; inspect the resulting diff and checks. Merging a child directly into its current feature-branch base is not a release to main.

| PR                                                   | Purpose                                      | Current base              | Head      |
| ---------------------------------------------------- | -------------------------------------------- | ------------------------- | --------- |
| [50](https://github.com/drrius/household-os/pull/50) | Calendar and private iCloud synchronization  | #48                       | `39718bd` |
| [52](https://github.com/drrius/household-os/pull/52) | Projects, trips and task coordination        | #48                       | `0227db3` |
| [58](https://github.com/drrius/household-os/pull/58) | Link paid expenses to plans and records      | #48                       | `60fc733` |
| [51](https://github.com/drrius/household-os/pull/51) | Inventory, renewals, decisions and documents | #52                       | `0523d87` |
| [60](https://github.com/drrius/household-os/pull/60) | Bookings and itinerary                       | #52                       | `8b76626` |
| [67](https://github.com/drrius/household-os/pull/67) | Combine calendar/bookings with Home records  | #51; includes #50 and #60 | `5e359ac` |
| [68](https://github.com/drrius/household-os/pull/68) | Exact posted expense from shopping history   | #47                       | `62db608` |

The integration PRs include their source feature commits. They are not independent copies to apply twice. Use the focused PRs to review individual features, then inspect the remaining integration diff after the selected dependencies land.

## Not ready

- [#55](https://github.com/drrius/household-os/pull/55), `8317481`, is based on #67 and includes #47. Verify/database CI and CodeRabbit review passed. Browser job `101315479898` failed: the calendar save check timed out, and both retries failed while loading the fixture. Its targeted job rerun was requested; search remains not ready.
- [#66](https://github.com/drrius/household-os/pull/66), includes realtime authentication follow-up #70, remains draft. It integrates the remaining workflows and Today agenda. The authenticated journey has established persisted travel costs, correction/refund history, partner balances and task completion, but the other member's open checklist remains stale. Run `33970334168` confirmed that socket joins succeed but database subscriptions report table/column errors. Search edit/return passed; shopping stopped at partner visibility. PR70 waits for authentication before subscribing and still needs combined runtime proof.

All 15 expansion PRs had zero unresolved review threads at this snapshot. CodeRabbit positively reviewed `1514451` in comment 5552296356 after the earlier service error. PR70 and its assembly integration still require review and CI.

Many Vercel previews hit a build rate limit; canceled or ignored previews also do not count as working deployments. The separate pre-existing draft #40 is outside this expansion effort. See [integrated acceptance](integrated-acceptance.md) for evidence and remaining gates, and the [release guide](../household-release-runbook.md) for manual setup and device checks.

[#70](https://github.com/drrius/household-os/pull/70), `15dfb0b`, is based on #69 and waits for realtime authentication before joining. Five focused lifecycle/authentication tests pass; delayed-session regressions failed before the fix. This follow-up is not ready until CI and CodeRabbit review complete.
