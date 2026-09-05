# ADR 0028: Complete the household operating system

- Status: Accepted by the household owner in the implementation request and scope clarification.
- Date: 2026-09-05
- Amends: the v1 feature freeze, ADR 0002, ADR 0004's calendar exclusion, ADR 0020 attachment formats, and the deferred design phase.

## Decision

Implement the agreed household product expansion: trips with bookings and itinerary, shared projects, a shared calendar connected privately to the existing iCloud calendar, home inventory and maintenance, recurring commitments and renewals, and shared decisions/wishlists. Complete the existing product's unfinished daily workflows and discover other worthwhile missing functionality throughout the entire application. The user explicitly authorizes autonomous product and visual-design decisions and appropriate reviewed PRs.

Calendar events describe commitments. Work items describe responsibility. Paid financial events alone affect the ledger; estimates, unpaid bookings, calendar edits, and checklist progress never post money. Link these domains by identity without duplicating financial history. Deleting or rescheduling a calendar event cannot reverse a payment.

Keep the five primary destinations comfortable on phones. Secondary navigation can expose the additional capabilities without placing every feature in the bottom bar. Design common actions for direct manipulation, readable detail states, concise input, specific errors, and accessible reduced-motion behavior.

Private PDF documents are permitted alongside resized photos, with a 4 MiB per-file limit. This narrow extension supports receipts, booking confirmations, contracts, warranties, and manuals. Files remain private and authorized by household membership. Uploads cannot overwrite existing financial receipts. Public calendar feeds are not the preferred integration; private CalDAV credentials stay encrypted on the server and the integration selects only the household's chosen calendar.

Preserve tenant isolation, two equal members, passkeys, CHF integer-centime accounting, append-only history, online-only operation, and existing operating-cost boundaries (including only the separately authorized assistant exceptions in ADR 0027). This decision does not authorize new paid infrastructure, payments, banks, OCR, analytics, backups/exports, public sharing, production changes, or merging PRs.

## Delivery

Use docs/expansion/goal.md as the persistent effective goal, including the user's explicit app-wide scope clarification. Record additional decisions and acceptance criteria as implementation proceeds. Deliver complete slices as independently reviewable or clearly dependency-ordered PRs. Verify every tenant invariant and financial change. Resolve substantiated CodeRabbit findings, explain disagreements, and request rereview until positive feedback. Document external credential and service blockers without claiming their live verification.
