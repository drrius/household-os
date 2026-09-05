# Assistant tool parity follow-up

The expansion is merged into main at `dd277fcd6b99ffb48d9eaae0a86faf359f6b1a1d`. PR #67 was closed as superseded. User authorization covers completing, reviewing and merging the separate parity follow-up, PR #72. PR #40 is excluded and has not been changed.

## Action coverage

The shared contract currently advertises 113 tools. `src/lib/ai/contract.test.ts` verifies that every advertised read/write has a runtime executor, that chat exposes the same contract, that all seven financial tools require approval and show the financial warning, and that running/completed tool labels are distinct. This registry check complements the behavioral tests below; it does not prove live account operations.

| App action family    | Assistant coverage                                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Today and search     | Original routine/meal/money overview plus connected household agenda; paginated household search with real record IDs.                                                                                                                                       |
| Projects and tasks   | List/detail, task detail and paged history; create/edit/archive/restore plans and tasks; assignment, complete/reopen; starter checklist discovery and selected batch application.                                                                            |
| Trips and bookings   | Itinerary/detail reads with local clocks and ambiguity choices; create/edit/archive/restore through the scoped booking commands. Estimates remain separate from paid costs.                                                                                  |
| Calendar             | Week/occurrence reads, form-ready local values, create/edit/cancel, safe local/remote conflict comparison and versioned resolution. All-day form end dates include the last day.                                                                             |
| iCloud               | Connection status, available calendars, selection, explicit synchronization and disconnect through existing guarded commands. Credential entry is a UI handoff.                                                                                              |
| Home records         | Inventory, contacts, commitments/renewals, decisions/options, documents, maintenance and asset/routine links: paginated active/archived reads, related-parent filters, create/edit/archive/restore; option choice, decision status and conversion to a plan. |
| Money                | Balances, drafts, recurring rules, financial-event/refund details; approved expenses, contextual expenses, refunds, settlements, opening balance, confirmations and corrections. History continuation uses date + creation timestamp + ID to retain ties.    |
| Context associations | Paid cost totals/event pages and existing expense associations; versioned link/reassign/unlink without changing ledger amounts or balances. Contextual expense approval displays and validates current record/booking titles.                                |
| Recurring expenses   | Create/activate/deactivate plus versioned edits and reads of exact proposed allocations. Rules produce drafts, not automatic payments.                                                                                                                       |
| Meal planning        | Existing placement/movement/update/removal/leftovers/preparation creation; detailed meal connections and versioned preparation edits.                                                                                                                        |
| Meal library         | Paginated active/archived saved meals; create/edit/archive/restore meals and default grocery templates; save a real planned meal to the library.                                                                                                             |
| Groceries            | Read/add/edit/remove/claim/release/merge, start/finish/cancel shopping, purchased history and trip detail, buy again; category create/edit/order/archive/restore and paginated category reads.                                                               |
| Routines             | Create/edit/pause/resume/archive; current occurrences and history; complete with a validated uploaded photo, skip and validated reschedule.                                                                                                                  |
| Household setup      | Household naming; area/pet create/rename; complete area ordering. No area/pet archive command exists in the inspected UI; storage columns alone do not imply an additional action.                                                                           |
| Inbox and digest     | Member-scoped inbox pagination, mark-read and digest preference read/write. The partner's private inbox is not exposed.                                                                                                                                      |
| Attachments          | Verify household access and return an authenticated app link; storage usage and guarded unused-upload cleanup. Saved files remain protected.                                                                                                                 |

The audit inspected product server-action exports and the underlying commands/read models, including library, starter, calendar, Home, attachment, notification and security entry points. New tools reuse those authorized commands. Tenant identity always comes from the authenticated context, not a model-supplied household ID.

## Retry and edit safeguards

- Projects, bookings, Home records, calendar creates, meal library/templates, categories, groceries, areas and pets use stable invocation-derived creation identities. Identical retries acknowledge existing records; changed collisions do not overwrite them.
- Routine creation uses the new atomic `create_routine_once` wrapper, preserving the existing routine validation and occurrence generation. Private receipts bind household, actor, request and result under a transaction lock.
- Existing meal, routine mutation, ledger and contextual commands retain their database retry contracts. Versioned edits retain the read version; they do not substitute a freshly fetched baseline.
- Monetary amounts remain integer CHF centimes. Existing append-only financial commands and approval handling remain in force. No tool converts a budget or estimate into an obligation implicitly.

## Explicit member handoffs

- Apple email/app-specific password entry: `/home/calendar`. The server encryption key is necessary but does not connect or select the shared calendar. Sync remains explicit; no new scheduled infrastructure is required.
- File selection/upload: the appropriate document, receipt or completion form. Existing uploaded paths may be passed to tools after lookup; tools never invent a path or claim metadata is file contents.
- Passkey enrollment, recovery and device removal/management: the security UI and native credential ceremony. Browser push enrollment, permission prompts, device unsubscribe and delivery testing: `/home/notifications` on that device. These operations depend on device-held state/credentials and are not represented as completed by server-only tool calls.
- Authenticated attachment links do not expose signed storage tokens in tool output. Cleanup completion does not claim a linked file was deleted.

## Verification and release status

Focused example/property tests cover monetary amounts and approval bindings, calendar all-day round trips and creation retries, stale edit/request handling, same-day financial pagination, category/household creation retries, attachment isolation, and registry/approval coverage. Scoped lint and typechecking pass at the implementation checkpoints. Full hosted verification is required before merge.

Expansion main CI `33990138172` passed verification, database, Chromium and member E2E, but failed two mobile-Safari tests. A local reproduction confirmed development Fast Refresh interrupting navigation between unrelated auth gates. Those checks are now separate tests, and the search-list destination is compiled before its form interaction. All three targeted mobile-Safari checks passed in 16.1 seconds with the product assertions retained. Final main E2E remains required.

The new routine retry migration has focused database coverage in `047_routine_creation_retries.test.sql`. It could not be run locally: this user cannot access Docker and no database listens on the configured local port. Hosted database CI must pass; this is not recorded as a local pass. The migration is append-only and uses the existing migration deployment path. No additional environment variables or paid infrastructure are introduced.

Remaining release work: inspect hosted verification/database results and CodeRabbit feedback, resolve substantiated findings and review threads, merge #72 when ready, and verify the final main browser/member run. Live iCloud round-trip, passkey ceremony and push delivery remain external account/device checks and must not be claimed from fixtures. Keep the goal active until the merge and required final CI are verified.
