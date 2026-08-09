# ADR 0010: Give both partners equal authority with reversible, synchronized changes

- Status: Accepted
- Date: 2026-08-09

## Context

Approval workflows would make everyday household coordination cumbersome, but concurrent actions and network retries must not corrupt completions or financial balances.

## Decision

Both members may change routines, meal plans, grocery items, and expenses without prior approval. Changes synchronize promptly while the application is online, and important changes remain visible and reversible. Offline operation is excluded from version one.

Conflicting descriptive edits use the latest accepted edit while retaining recovery history. Completion and financial-event creation must be idempotent so network retries cannot create duplicates.

Manual expenses affect the balance immediately. Generated recurring and shopping expenses remain drafts until their required information is confirmed.

## Consequences

Trust comes from transparency and recovery rather than permission gates. The backend must support idempotent commands and an activity history. The client must clearly report when an action cannot be saved because connectivity is unavailable.
