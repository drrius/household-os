# ADR 0026: Preserve reschedules through routine window rebuilds

- Status: Accepted
- Date: 2026-08-30

## Context

Editing a routine's assignment, schedule, or active window rebuilds the open occurrence window: the current and preview occurrences are deleted and recreated from today's calendar grid. Because the recreated current occurrence always re-derived its due date, a reschedule of the current occurrence (a `due_date` differing from `original_due_date`, per ADR 0014) was silently discarded for every schedule kind, even by edits that did not touch the schedule.

## Decision

When an edit leaves the schedule rule unchanged, the rebuild recreates the current occurrence with both its previous `due_date` and its previous `original_due_date`: the reschedule survives, and the preview continues to follow the original recurrence anchor. When the edit changes the schedule rule, the rebuild keeps its existing behavior and re-anchors from the rebuild day (with the biweekly phase preservation of ADR 0025).

A preserved due date must still fall inside the routine's active window; if a new `active_from` excludes it, the rebuild re-anchors as before.

Rebuilds delete the open occurrences they replace, but a rescheduled current occurrence is referenced by its reschedule command receipt, so before this change the delete violated the receipts foreign key and the edit failed outright. Command receipts are the idempotency ledger and must outlive the occurrence they acted on: deleting an occurrence now sets the referencing receipt's `occurrence_id` to null instead of blocking the delete.

## Consequences

Assignment-only and active-window edits no longer reset a rescheduled current occurrence, including one that is overdue. Reschedules remain single-occurrence adjustments as ADR 0014 defines them; recurrence continues to derive from `original_due_date`.
