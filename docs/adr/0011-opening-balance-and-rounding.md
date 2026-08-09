# ADR 0011: Migrate with an opening balance and deterministic CHF rounding

- Status: Accepted
- Date: 2026-08-09

## Context

The new ledger needs a trustworthy starting point without reproducing every historical Splitwise transaction. Equal division of odd-cent CHF amounts also requires a deterministic rule.

## Decision

Migration uses one visible opening-balance event agreed by both members rather than importing historical transactions.

All CHF values are stored as integer centimes. For an equal split with a remainder, the payer's own allocation absorbs the extra cent; the other member's owed amount is rounded down and shown before saving.

## Consequences

Migration remains small and auditable. The balance engine can reproduce allocations exactly across clients and over time.
