# ADR 0020: Fix the product navigation and client interaction boundaries

- Status: Accepted
- Date: 2026-08-09

## Context

The visual design will happen separately, but implementation still requires stable destinations, attachment constraints, notification fallback, and mutation behavior.

## Decision

The application has five primary destinations: Today, Plan, Groceries, Money, and Home. Today is the default. Plan contains meals. Home contains routines, pet profiles, activity, members, and settings.

Images are compressed in the browser and limited to 4 MB after compression. The household receives a warning at 500 MB of attachment storage. Videos are excluded.

If Web Push is unavailable or declined, notifications remain in the in-app inbox without an external fallback.

Grocery edits, meal moves, and routine completions may update optimistically and roll back visibly on server failure. Financial events do not change the displayed balance until the authoritative server operation succeeds.

## Consequences

The later UI design has freedom over visual expression while preserving the product's information architecture and correctness boundaries.
