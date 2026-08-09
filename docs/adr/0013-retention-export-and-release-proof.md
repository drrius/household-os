# ADR 0013: Preserve application history and require a four-week replacement trial

- Status: Accepted
- Date: 2026-08-09

## Context

The product will become a source of truth for care and money. It needs recoverability and a concrete standard for deciding whether version one has succeeded.

## Decision

Financial events and routine completions are retained for the life of the household. Purchased groceries remain available for 30 days and general activity for 90 days. Routine definitions are archived rather than deleted, future meal plans may be removed, and financial changes use visible correcting events. Permanent deletion is limited to an explicit household-data reset.

Optional receipt and completion-photo attachments are supported without OCR or automatic itemization. Automated backups, a tested restore procedure, and on-demand household export are excluded from version one.

Household dates are anchored to `Europe/Zurich`. Version one succeeds after four consecutive weeks in which both members use it, recurring household care is represented, meals and groceries are coordinated in it, and no new Splitwise expenses are entered. A critical synchronization error or unreproducible balance restarts the trial.

## Consequences

Release readiness includes a real-use trial rather than merely feature completion. Storage lifecycle rules must distinguish durable records from short-lived convenience history. Version-one users accept that free-tier infrastructure provides no application-managed recovery guarantee.
