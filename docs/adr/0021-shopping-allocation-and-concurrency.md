# ADR 0021: Separate receipt totals from shared allocation and permit concurrent shopping

- Status: Accepted
- Date: 2026-08-09

## Context

A shopping receipt may contain personal purchases, and both household members may shop from the same list simultaneously.

## Decision

A completed shopping session may record the receipt total separately from the amount treated as a shared household expense. The member explicitly enters the shared amount and allocation; itemization is not required.

Each member may have one active shopping session. Items claimed by one session remain visible to the other member but are marked as being handled.

## Consequences

The financial ledger never implies that an entire mixed receipt was shared. Concurrent shopping remains possible without making claimed items disappear or encouraging duplicate purchases.
