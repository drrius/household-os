# ADR 0023: Fix version-one scheduling, categorization, and notification defaults

- Status: Accepted
- Date: 2026-08-09

## Context

Routine creation, meal planning, grocery ordering, expense recognition, and partner notifications need bounded version-one behavior.

## Decision

Routine schedules support one-off, daily, selected weekdays, weekly, monthly by date, and every N days or weeks after completion. Routines may be paused indefinitely or limited to an active date range. Complex recurrence expressions and automatic seasons are excluded.

Editable routine areas begin with Cleaning, Kitchen, Laundry, Dog, Meals, and General. Each occurrence may issue one optional personal reminder at a chosen time on its due day.

The meal week runs Monday through Sunday in `Europe/Zurich`. Each breakfast, lunch, or dinner slot holds one meal-plan entry with a free-form title, notes, and optional recipe reference.

Groceries are grouped by editable category and manually ordered within each category. Shopping preserves that order.

Editable expense categories begin with Groceries, Dining, Home, Pet, Utilities, Rent, and Other. Money's primary result is one net CHF balance with full and partial settlement actions and an expandable event explanation.

Partner push notifications are created for financial mutations, assignment or schedule changes affecting that member, shopping-session completion, and direct swaps. Routine completions and ordinary meal edits remain in activity history only.

The two members are permanent equal participants in version one. Member departure and ownership transfer are excluded; an administrator-only household reset is the only whole-household destructive operation.

Release testing targets current iPhone Safari as an installed web app and current desktop Safari and Chrome. The product requires keyboard operation, visible focus, reduced-motion behavior, sufficient contrast, and WCAG 2.2 AA semantics.

## Consequences

The product supports the common household cases without requiring a general calendar, finance taxonomy, organization-role system, or messaging engine.
