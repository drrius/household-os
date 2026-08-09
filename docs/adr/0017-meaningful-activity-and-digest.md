# ADR 0017: Record meaningful changes and keep debt out of the daily digest

- Status: Accepted
- Date: 2026-08-09

## Context

The household needs enough history to understand changes without producing an unreadable audit feed or repeatedly surfacing personal debt.

## Decision

The 90-day activity record includes routine creation and schedule changes, completions and skips, meal-plan changes, shopping-session completion, and every financial mutation. Grocery keystrokes and screen visits are excluded.

The household digest includes overdue and due-today routines, today's meals and preparation tasks, whether the grocery list is active, and unconfirmed financial drafts. Current balances remain inside Money.

## Consequences

The activity record remains useful for recovery and accountability, while reminders focus on actions rather than repeatedly announcing who owes whom.
