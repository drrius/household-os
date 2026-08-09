# Implementation milestones

Milestones are dependency-ordered integration gates, not calendar estimates. A later milestone may begin in parallel only when its required contracts are frozen.

## M0: Repository foundation

Deliver the pnpm workspace, Next.js shell, Supabase local configuration, tenancy migration, pure domain package, baseline tests, CI, and agent ownership rules.

Exit criteria:

- `pnpm verify` passes.
- Local Supabase starts and its database tests pass.
- The neutral application shell builds without inventing visual design.
- The repository has no committed secrets.

## M1: Identity and tenancy

Implement passkey client flows, local administrator enrollment and recovery commands, household bootstrap, membership RLS tests, protected application routing, and the Security surface contract without visual styling.

Exit criteria:

- Two provisioned users can enroll and use discoverable passkeys.
- Public signup and cross-household access fail.
- Losing a passkey has a tested administrator recovery path.
- The production-hostname gate is documented and automated where possible.

## M2: Routine engine

Implement areas, pets, routine definitions, schedule validation, occurrence generation, assignment and alternation, completion, skip, reschedule, pause, archive, activity events, and reminder candidates.

Exit criteria:

- Calendar and completion-based recurrence pass example and property tests.
- Every closure path preserves history and generates at most one next occurrence.
- Concurrent completion commands are idempotent.

## M3: Meals and groceries

Implement the meal library, weekly planning slots, leftovers, preparation occurrences, editable grocery categories, duplicate suggestions, item provenance, concurrent shopping sessions, and 30-day purchased history.

Exit criteria:

- Leftovers never add default groceries twice.
- One member cannot claim an item already claimed by an active session.
- Finishing shopping creates at most one expense draft and no ledger event.

## M4: CHF ledger

Implement categories, opening balance, manual expenses, 50/50 and exact allocations, immutable ledger entries, recurring drafts, shopping drafts, refunds, settlements, reversals, replacements, and explainable balances.

Exit criteria:

- Every event balances to zero in database and property tests.
- Odd centimes are assigned to the payer's allocation.
- Retried commands post one event.
- No client can edit a derived balance or destructively rewrite financial history.

## M5: Notifications and realtime

Implement the in-app inbox, per-member digest preferences, per-routine reminders, Web Push subscriptions, partner-notification rules, realtime cache invalidation, and retention jobs.

Exit criteria:

- Actors are not notified of their own actions.
- The digest omits owed balances.
- Declined push permission leaves the in-app inbox functional.
- Scheduled jobs are idempotent and observable within the free platform.

## M6: Designed product integration

Integrate the user's separately approved visual system across Today, Plan, Groceries, Money, and Home. This milestone begins only after the visual source of truth exists.

Exit criteria:

- The implementation is visually verified against the accepted design at mobile and desktop sizes.
- Current iPhone Safari, desktop Safari, and Chrome pass critical flows.
- Keyboard, focus, reduced-motion, contrast, and semantic accessibility checks pass.

## M7: Household trial

Deploy to the stable Vercel hostname, enroll both passkeys, establish the opening CHF balance, seed real routines and meal defaults, and begin the four-week replacement trial.

Exit criteria:

- Both members use the app for four consecutive weeks.
- No new Splitwise expenses are added.
- No critical sync failure or unreproducible balance occurs.
