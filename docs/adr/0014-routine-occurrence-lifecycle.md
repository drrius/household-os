# ADR 0014: Generate routine occurrences incrementally with explicit closure

- Status: Accepted
- Date: 2026-08-09

## Context

Recurring household work must preserve missed and completed history without producing large numbers of future records that become stale when a schedule changes.

## Decision

Each recurring routine maintains one current occurrence and a preview of the next. An occurrence is explicitly completed, skipped, or rescheduled. Skipping preserves the routine cadence; rescheduling changes only that occurrence unless the member explicitly changes the routine definition.

Calendar-based routines follow their calendar anchor. Completion-based routines calculate the next due date from the actual completion. Overdue work is ordered by care sensitivity and then age, with pet care ahead of meal deadlines, cleaning, and general chores. Individual routines may override their default priority.

## Consequences

Schedule changes affect a small, predictable set of records, while history retains the distinction between completed, skipped, and rescheduled work.
