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

PR69 fixes a reproduced lifecycle race. The combined PR69 + PR70 fix passed partner task and shopping refresh in member job 101319046580.

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
| [70](https://github.com/drrius/household-os/pull/70) | Authenticate before realtime subscription | #69 | `15dfb0b` |
| [55](https://github.com/drrius/household-os/pull/55) | Household search and preserved result context | #67; includes #47 | `8317481` |

The integration PRs include their source feature commits. They are not independent copies to apply twice. Use the focused PRs to review individual features, then inspect the remaining integration diff after the selected dependencies land.

## Not ready

- [#66](https://github.com/drrius/household-os/pull/66) remains draft. Published head `82d9cd0` passed the authenticated two-member journey in job `101319942128`: travel correction/refund balances, exact task notifications, partner task/cart refresh, search context, shopping draft/posting/event links, inventory/contact/maintenance, renewal deadlines and decision conversion. Full browser job `101319942152` remains running. Additional booking conflict/archive/restore, device sign-out, and readable-date acceptance changes are integrated locally but not yet pushed or runtime-verified.
- [#71](https://github.com/drrius/household-os/pull/71), `27c7694`, based on #51, makes Home/Money dates and correction labels readable. Verify passed; browser CI and explicit review completion remain pending.

Search #55's browser rerun `101318950570` passed. Its verify/database gates and positive CodeRabbit verdict `5552253899` already passed. PR70's browser job `101318807855` passed, with explicit approval `5552395668` and no unresolved threads. The previous 15-PR review-thread audit found zero unresolved threads; new PR71 still needs the final audit.

Many Vercel previews hit a build rate limit; canceled or ignored previews also do not count as working deployments. The separate pre-existing draft #40 is outside this expansion effort. See [integrated acceptance](integrated-acceptance.md) for evidence and remaining gates, and the [release guide](../household-release-runbook.md) for manual setup and device checks.
