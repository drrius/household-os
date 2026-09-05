# Assistant tool parity follow-up

User direction, September 5, 2026: finish merging the current expansion PRs first, then implement a separate assistant parity PR, address substantiated CodeRabbit findings, and merge when ready. This follow-up is now explicitly authorized. PR #40 remains outside this work.

The assistant audit found that the registered tools and executors still cover the original routines, meals, groceries, household setup, and money capabilities. The inspected expansion branches do not add assistant tools for the new connected household features. Their UI implementation does not establish assistant parity.

After the expansion merges, audit the final merged application action by action and add missing read and mutation tools for projects, trips, bookings and itineraries, calendar and iCloud operations, inventory and maintenance, contacts, commitments and renewals, decisions, documents, household search, and contextual expense associations. Also check additions to the existing workflows rather than assuming their old tools remain complete.

Use the shared tool contract for in-app chat and the MCP bridge where available. Reuse the UI's authorized domain commands, preserve tenant isolation, concurrency checks and retry safety, and retain explicit financial approval. Keep credentials out of model-visible inputs and outputs; document any device-bound or credential-entry operations that require a user-facing handoff. Verify complete read-to-action journeys and report any remaining parity gaps honestly.

## Implementation audit starting points

The assembled branch exposes the following command families, which must be checked against the final merged tree before implementation:

| Workflow           | Existing entry points                                                            | Parity acceptance                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Projects and tasks | Project actions, project queries, starter action                                 | Find real IDs; create/edit/archive/restore plans; assign and transition tasks; apply starter checklists with retry identity; read history and pagination.                                  |
| Bookings           | `saveBooking`, `archiveBooking`, booking queries                                 | Read itinerary and detail; preserve local time zones; create/edit/archive/restore with revision checks.                                                                                    |
| Calendar           | Calendar commands, agenda/context, connection/sync                               | Read occurrences and event versions; create/edit/cancel; inspect and resolve conflicts; list/select/sync/disconnect an existing connection. Apple password entry stays in the settings UI. |
| Household records  | `saveRecord`, `archiveRecord`, decision commands and record queries              | Cover every record kind, relationships, option choice/status/conversion, archived records and pagination. File upload requires a real attachment handoff, never an invented storage path.  |
| Contextual money   | Context expense and association actions                                          | Read paid/estimated amounts separately; post approved expenses and assign/reassign/unlink context with stable retries and revisions.                                                       |
| Existing workflows | Meal library/template/preparation, recurring money and all other product actions | Compare every action against current registry and executor; do not assume original tools cover later additions.                                                                            |
| Search and Today   | Household search and expanded agenda read models                                 | Return discoverable IDs and context for subsequent actions, including bounded/paged results and the expanded Today agenda.                                                                 |

These are audit targets, not implemented tool coverage. The six current read tools still describe only the original overview/routines/meals/groceries/money/household surfaces.

## Implementation checkpoint — September 5

All expansion work is merged into main at `dd277fcd6b99ffb48d9eaae0a86faf359f6b1a1d`; #67 was closed as superseded. #40 is excluded. The separate `codex/ai-household-parity` branch is in progress and has not yet been reviewed or merged.

Implemented so far: connected plan/task/bookings/Home reads and mutations; project history and starter checklists; calendar occurrence edit values, sanitized conflict details and connection operations; connected Today agenda; contextual cost/association reads, atomic approved expense posting and revision-guarded association changes. Calendar create retries reuse an invocation identity. Contextual expense approval displays and validates the record and booking titles. File uploads, Apple credentials and device enrollment require explicit UI handoffs.

Focused tests cover monetary examples and generated integer-centime cases, calendar all-day round trips, duplicate calendar creates, stale approval bindings, privacy, and tool schema serialization. Final hosted verification and CodeRabbit review remain outstanding. The original workflow audit (meal library/templates/preparation, groceries, recurring-rule editing, settings/inbox and related actions), remaining handler tests and final acceptance checks are still required. This checkpoint does not claim complete parity.
