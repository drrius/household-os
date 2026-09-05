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

## Home record extension under ADR 0028

The authorized household expansion adds saved contacts, inventory, commitments,
decisions and their options, documents, and maintenance history to the same
90-day activity stream. A record save and its activity entry commit atomically.
The actor comes from the authenticated household membership; trusted provisioning
without an end-user actor is omitted.

Entries snapshot only the record label, kind, and added/updated/archived/restored
operation. Notes, serial numbers, contact details, and private attachment paths
are not copied into activity. Unchanged saves and archive timestamp refreshes are
quiet. This extension does not add notifications, ledger entries, or a longer
retention period.
