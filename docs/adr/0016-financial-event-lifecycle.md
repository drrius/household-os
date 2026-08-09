# ADR 0016: Represent refunds, settlements, and corrections as visible events

- Status: Accepted
- Date: 2026-08-09

## Context

Overwriting past financial data makes current balances difficult to explain. Refunds, partial repayments, and corrected mistakes need explicit semantics.

## Decision

An expense stores description, CHF amount, payer, allocation, date, and optional category, note, receipt, and shopping-session link. Refunds are negative events linked to their original expense. Full and partial external settlements may be recorded by either member, affect the balance immediately, notify the other member, and remain correctable through visible reversing events.

Recurring-expense drafts support monthly fixed-date and simple weekly schedules. They do not affect the balance until confirmed.

## Consequences

Every financial balance remains reproducible from visible events. Financial mutations require durable activity entries and must never be implemented as destructive overwrites.
