# ADR 0029: Show one household week on Plan

- Status: Accepted by the household owner in conversation.
- Date: 2026-09-06 (Europe/Zurich)
- Amends: the Plan destination in ADR 0002 and `docs/product-scope.md`; the calendar screen introduced by ADR 0028.

## Context

After ADR 0028 the same week appeared in three places with different content. Plan showed meals only. The shared calendar showed events only. Today merged routines, meals, events, bookings and deadlines, but only for today plus six days and only as a list. Trips and projects lived under Plan but were not reachable from the Plan screen.

On a phone the meal board showed one day at a time with three empty dashed boxes. It read as a calendar with nothing in it.

## Decision

Plan is the household week. Each Monday-to-Sunday day column shows three domain rows, in this order:

1. **Plans**: calendar events, bookings, trip spans, task due dates, project target dates, and commitment deadlines that fall on that day. A multi-day event or trip appears on every day it covers. A timed item shows its start time only on its first day.
2. **Routines**: routine occurrences due that day, and completions recorded that day. An open occurrence that is overdue appears in today's column when today is in the viewed week. A member can mark an occurrence done from the week only when it is due today or earlier. Preparation tasks linked to a meal stay on the meal card and do not repeat in the routine row.
3. **Meals**: the breakfast, lunch and dinner slots from the existing meal board.

The rows keep the domains separate, as ADR 0008 requires. The week does not become one mixed feed. No week action posts money, changes a booking, or edits a calendar event.

Secondary navigation on Plan links to Our calendar, Trips and Projects. Our calendar remains the surface for iCloud sync, conflicts and event editing. Today remains the daily action list.

If the plans and routines sources fail to load, the meal board still renders and the screen says which part is unavailable, with a retry. Authentication redirects still propagate.

## Consequences

- `src/domain/plan/week.ts` holds the pure placement rules and shares label helpers with the Today agenda.
- The Plan read model loads calendar occurrences, projects, tasks, bookings, commitments and routine occurrences for the viewed week through the same paged loaders that Today uses.
- Realtime invalidation adds Plan to routine completion and commitment changes.
- Meal ideas and the meal library stay below the board on Plan.
