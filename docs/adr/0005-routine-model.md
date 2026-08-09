# ADR 0005: Use one routine model with explicit occurrence history

- Status: Accepted
- Date: 2026-08-09

## Context

Chores, cleaning, and pet care share the same essential behavior: responsibility recurs, a member performs it, and the household needs to know what is due and what happened. Separate engines would duplicate scheduling and completion logic.

## Decision

Chores, cleaning, and pet care use one routine model organized by area or label. A routine may be one-off, calendar-based, or completion-based. Its assignment may name one member, alternate between members, or remain shared.

Each expected instance is an occurrence. An occurrence remains overdue until it is completed, explicitly skipped, or rescheduled; a later occurrence never silently replaces it. Completion is a one-tap action with optional notes and photos.

Alternating responsibility follows the planned sequence rather than the identity of the member who actually completes an occurrence. An explicit swap may change that sequence.

## Consequences

The system can answer both what is due and what actually happened without inventing separate semantics for cleaning and pet care. Occurrences and completion records must be preserved independently from the routine definition.
