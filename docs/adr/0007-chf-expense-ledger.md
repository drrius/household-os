# ADR 0007: Use an auditable CHF shared-expense ledger

- Status: Accepted
- Date: 2026-08-09

## Context

Version one only needs to answer who owes whom for a two-person household. The current problem is fragmentation across applications rather than a need for banking or budgeting functionality.

## Decision

Version one uses CHF only. Expenses default to a 50/50 split and may be overridden with exact CHF allocations. The ledger supports expenses, corrections, refunds, recurring-expense drafts, an opening balance or historical import, and settlements recorded as transfers made outside the application.

Corrections remain visible after an expense has affected the balance. Recurring expenses create drafts for confirmation rather than posting automatically. The application will not initiate payments, connect to bank accounts, calculate budgets, or convert currencies.

## Consequences

The CHF balance must always be derivable from immutable financial events and their visible corrections. Monetary values require integer minor-unit storage and deterministic allocation rules.
