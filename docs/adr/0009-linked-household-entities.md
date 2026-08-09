# ADR 0009: Link specialized household entities without duplicating task machinery

- Status: Accepted
- Date: 2026-08-09

## Context

Pet care and meal preparation need recognizable context, but separate scheduling and task engines would produce inconsistent behavior.

## Decision

A pet is represented by a lightweight profile containing a name, photo, and linked routines. Veterinary records, medication tracking, and health measurements are excluded from version one.

Meal preparation work uses one-off routine occurrences linked to a meal. Grocery items support an optional quantity, unit, category, note, and originating meal. Version one has one shared grocery list without preferred stores or assigned buyers.

## Consequences

Pet and meal experiences can feel specific while reusing routine assignment, reminder, completion, and history behavior. The model permits future specialization without requiring it now.
