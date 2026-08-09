# ADR 0003: Keep household work and financial obligations separate

- Status: Accepted
- Date: 2026-08-09

## Context

The system needs to make both household work and shared expenses visible. Combining them into a single score would imply that chores have an agreed monetary value and could turn coordination into competition.

## Decision

Routines may be assigned to one member, alternate between members, or remain shared. The system records completion history without points, leaderboards, or monetary credit.

Expenses maintain a separate ledger whose purpose is to answer who owes whom. Household work never changes a financial balance.

## Consequences

The product can improve fairness and visibility without claiming that money and labor are interchangeable. Work history and financial balances require separate domain models and separate calculations.
