# ADR 0006: Connect a flexible meal board to a recoverable grocery workflow

- Status: Accepted
- Date: 2026-08-09

## Context

Meal planning should reduce coordination work without requiring every meal to be planned or creating a fragile pantry database.

## Decision

The weekly meal board provides optional breakfast, lunch, and dinner slots, supports leftovers and eating out, and includes an unscheduled ideas area. Meals may reference external recipes and generate grocery items or preparation tasks.

Purchased grocery items leave the active list but remain in a short recent history with their originating meal when applicable. Completing a shopping trip may offer to create one expense from a user-entered receipt total and payer. The system will not infer item prices or silently create expenses.

## Consequences

Meal planning, preparation, shopping, and expenses form a connected flow while each transition remains explicit. Recent grocery history requires a retention rule that remains to be decided.
