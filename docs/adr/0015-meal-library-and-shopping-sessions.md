# ADR 0015: Reuse meals and group purchases through explicit shopping sessions

- Status: Accepted
- Date: 2026-08-09

## Context

Repeated meals should not require repeated setup, and a receipt must correspond to a known set of purchased grocery items before it can become an expense.

## Decision

The meal library stores a name, recipe link, notes, and default grocery items. A leftover meal references an earlier planned meal and does not add its groceries again.

Potentially duplicate grocery items produce a merge suggestion. Differing quantities or units require confirmation rather than silent combination.

Shopping uses an explicit session. Items checked during that session belong to it, and finishing the session offers a receipt attachment and a single draft expense for those items.

## Consequences

The application can connect planning to shopping to money without guessing which purchases belong together. Shopping sessions become durable link entities even though item-level prices remain out of scope.
