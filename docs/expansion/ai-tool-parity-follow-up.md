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

### Original-workflow audit checkpoint

Added recurring-rule reads and versioned edits (including exact custom allocations and clamped month-end dates); paginated active/archived meal-library reads; saved meal and default-grocery create/edit/archive/restore; grocery edits/duplicate merge/cancellation; shopping history and detail; and buying a purchased grocery again. AI grocery creation and buy-again now use stable creation IDs, acknowledging an identical existing active/claimed item and rejecting changed or historical collisions.

Still to implement or establish coverage: meal preparation detail/edit and meal connections; routine occurrence/history reads and any lifecycle gaps; grocery-category management; household area/pet edit/archive/order; notification/inbox/digest actions and device-bound handoffs; attachment metadata access; full financial-event pagination (the original date-only cursor can skip same-day events); and remaining end-to-end tool contract/approval tests. Audit the UI action inventory for additional gaps before claiming parity. Existing scope and final hosted/review/merge requirements remain unchanged.

### Daily work and notification checkpoint

Draft follow-up is PR #72. Added meal entry/connections/preparation reads, versioned preparation edits, routine occurrence/history reads, area/pet renaming, area ordering, member-scoped inbox reads/mark-read and digest preference reads/writes. The UI currently exposes no area/pet archive command, so the audit must not invent one from the storage columns.

Main expansion CI `33990138172` passed verification, database, Chromium and member E2E, but failed mobile-Safari on the auth-gate navigation and search-list return tests. A focused local reproduction confirmed Next development Fast Refresh interrupting navigation between unrelated auth gates; split them into independent checks. Precompile the search-list destination before the form interaction to keep cold dev compilation outside its assertion window. The three targeted mobile-Safari checks now pass (16.1s). Final main E2E remains outstanding; this is not a final integration pass.

Draft #72 CI `33991220911` passed full verification at `0f0641e`; browser/member/database jobs were skipped for that diff. CodeRabbit skipped the draft, and Vercel preview remains rate limited. Neither is presented as a completed review or successful deployment.

Remaining audit targets: grocery-category management; financial-event/draft detail and lossless history pagination; attachment metadata/open handoffs; old creation retry/concurrency gaps; complete handler/read/approval discovery coverage and readable assistant tool labels; final action inventory and acceptance review. Preserve the scope above and continue until final hosted checks, CodeRabbit review and merge are done.

Financial read coverage now includes event/refund/correction details and pending draft details. Money overview pagination returns a date + creation timestamp + ID cursor; a regression test traverses 41 events sharing the same date and instant across three pages without missing or repeating a record. Generated malformed cursors are rejected before filter construction. The legacy date filter remains available for choosing a starting range, not as the recommended continuation.

### Categories and attachments checkpoint

Added paginated active/archived grocery-category reads and create/edit/order/archive/restore, preserving the UI's previous-state concurrency checks. New category creates accept an optional stable identity and acknowledge only unchanged retry collisions. Added authenticated attachment links, usage reads and guarded unused-upload cleanup; links do not expose signed storage tokens, and cleanup does not claim saved files were deleted. Focused category retry and cross-household attachment property tests pass.

Remaining: shared read/write registry coverage and approval-contract audit; readable labels for new tools; original creation retry gaps (areas/pets and any remaining commands); final complete action inventory; finish CodeRabbit/hosted checks and merge #72, then final main browser/member verification. Document direct device/credential/file-picker handoffs clearly in the final report.
