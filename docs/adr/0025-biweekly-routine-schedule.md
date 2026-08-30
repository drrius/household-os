# ADR 0025: Add a biweekly routine schedule

- Status: Accepted
- Date: 2026-08-30

## Context

ADR 0023 fixed the version-one routine schedules to one-off, daily, selected weekdays, weekly, monthly by date, and completion-based intervals. Household use showed a gap between weekly and monthly: chores such as changing bed linen recur every two weeks on a fixed weekday, and neither existing calendar rule expresses that cadence. The household requested the addition explicitly.

## Decision

Routine schedules additionally support a biweekly calendar rule: every two weeks on one ISO weekday. The rule anchors its cadence on the first matching weekday, and succession anchors on the closed occurrence's original due date, so per ADR 0014 a reschedule moves only that occurrence and the two-week phase is preserved.

This is a single named cadence, not a step toward general recurrence. Complex recurrence expressions, arbitrary every-N intervals for calendar rules, and automatic seasons remain excluded.

## Consequences

The schedule list in ADR 0023 is amended by this addition and is otherwise unchanged. The occurrence lifecycle, reminder, and assignment behavior of ADR 0014 apply to biweekly routines without modification.
