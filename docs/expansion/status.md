# Money implementation status

The app-wide effective goal and current PR matrix live on the integration branch in `docs/expansion/goal.md` and `docs/expansion/status.md`. This is the Money branch checkpoint, replacing the original pre-implementation plan.

## Delivered in PR #49

- Inspectable financial events, original shares, receipts, and effects on both members.
- Partial refunds with exact/proportional previews and remaining-share limits.
- Corrections and opening-balance repair while retaining append-only history.
- Recurring expense setup and readable draft schedules.
- Recovery after rejected submissions and stable refund operation identity through background server refreshes.
- Recoverable attachment upload errors when an upstream service returns HTML.

CodeRabbit is the current reviewer. Three findings are addressed in the current follow-up (stale documentation, upload errors, refund operation identity). CodeRabbit withdrew the negative-share report after reviewing the example and property tests: the existing `parseChfToCentimes` grammar accepts only unsigned amounts and already produces a field-specific rejection.

## Stack and merge order

`main → #46 (routines) → #49 (Money)`. PR #49 targets `codex/routines-household` and includes its parent commits through `c9eb7be`. The parent supplies `edit_routine_definition`, required by the meal lifecycle database tests already on main. Merge #46 first; then retarget #49 to main, update its branch, and require fresh CI before merging #49.

## Verification and dependencies

The earlier 339-test main baseline was historical, not verification of this Money branch. Current follow-up verification is recorded in `money-coderabbit-review.md` when completed.

The private attachment foundation now exists and PR #44 was externally merged. This branch incorporates main through `fa09be9`, retaining the merged attachment security and retry implementation alongside the Money fixes. Combined verification remains required before merge. Repository visibility is now public and hosted CI is available. Local Postgres is unavailable on port 54322. No production database changes have been made.

Live iCloud credentials remain a separate setup requirement for the calendar branch. No live-account sync claim is made by this Money checkpoint.
