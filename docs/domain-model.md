# Household OS domain model

## Model boundary

Version one represents one private household with exactly two equal human members, zero or more pets, and one CHF financial ledger. The same household owns all routines, meals, groceries, shopping sessions, notifications, and activity records. Cross-household access is impossible by policy and database authorization.

Authentication identity is separate from household membership. Supabase Auth proves which user is present; a `HouseholdMember` row determines which household data that user may access.

## Household aggregate

### Household

The tenancy root.

- `id`
- `name`
- `timezone`, fixed to `Europe/Zurich` in version one
- `currency`, fixed to `CHF` in version one
- `created_at`
- `reset_at`, nullable

### HouseholdMember

Links one confirmed Supabase Auth user to the household.

- `household_id`
- `user_id`
- `display_name`
- `photo_path`, optional
- `joined_at`

Invariants:

- Version one has exactly two active members before household setup is considered complete.
- Both members have identical product permissions.
- Public membership creation is impossible.
- A member cannot be removed through normal product operations.

### Pet

A lightweight care subject rather than a login-bearing member.

- `id`
- `household_id`
- `name`
- `photo_path`, optional
- `archived_at`, nullable

Pet medical records, medication, health measurements, and financial participation are outside the model.

## Routine aggregate

### Routine

Defines household work and its recurrence.

- `id`
- `household_id`
- `title`
- `instructions`, optional
- `area_id`
- `pet_id`, optional
- `assignment_policy`: `assigned`, `alternating`, or `shared`
- `assigned_member_id`, required only for `assigned`
- `rotation_anchor_member_id`, required only for `alternating`
- `schedule_kind`: `one_off`, `calendar`, or `after_completion`
- `schedule_rule`, validated structured data
- `priority`: `pet_care`, `meal_deadline`, `cleaning`, or `general`, with an optional explicit override
- `active_from`, optional
- `active_until`, optional
- `paused_at`, nullable
- `archived_at`, nullable

Supported schedule rules are one-off date, daily, selected weekdays, weekly, every two weeks on a weekday, monthly by date, and every N days or weeks after completion.

### RoutineOccurrence

Represents one expected instance of a routine.

- `id`
- `routine_id`
- `due_date`
- `planned_assignee_id`, nullable for shared work
- `status`: `open`, `completed`, or `skipped`
- `original_due_date`
- `rescheduled_at`, nullable
- `closed_at`, nullable
- `idempotency_key`

### Completion

Records how an occurrence was satisfied.

- `occurrence_id`
- `completed_by_member_id`
- `completed_at`
- `note`, optional
- `photo_path`, optional

Routine invariants:

- Every occurrence remains open until explicitly completed, skipped, or rescheduled.
- Rescheduling changes one occurrence unless the routine definition is separately edited.
- Skipping preserves the recurrence cadence.
- Calendar recurrence follows its calendar anchor.
- Completion-based recurrence anchors its next due date to actual completion.
- Alternation follows the planned sequence, not the identity of the actual completer.
- One routine maintains one actionable current occurrence and one next preview.
- Repeated completion commands with the same idempotency key create one completion.
- Archiving a routine prevents future occurrences but preserves all existing history.

## Meals aggregate

### MealDefinition

A reusable entry in the meal library.

- `id`
- `household_id`
- `name`
- `recipe_url`, optional
- `notes`, optional
- `archived_at`, nullable

### MealGroceryTemplate

A default grocery item attached to a meal definition.

- `meal_definition_id`
- `name`
- `quantity`, optional
- `unit`, optional
- `grocery_category_id`, optional
- `note`, optional

### MealPlanEntry

Places one meal into one optional weekly slot.

- `id`
- `household_id`
- `date`
- `slot`: `breakfast`, `lunch`, or `dinner`
- `meal_definition_id`, optional
- `title_snapshot`
- `recipe_url_snapshot`, optional
- `notes`, optional
- `leftover_of_entry_id`, optional

Meal invariants:

- The planning week is Monday through Sunday in the household timezone.
- A date and slot contain at most one active meal-plan entry.
- A leftover entry references an earlier entry and does not add default groceries again.
- A preparation task is a one-off routine occurrence linked to its meal-plan entry.
- Removing a future meal-plan entry does not delete grocery items already intentionally retained or purchased.

## Grocery and shopping aggregate

### GroceryCategory

An editable and orderable grouping used by the shared list.

### GroceryItem

- `id`
- `household_id`
- `name`
- `quantity`, optional
- `unit`, optional
- `category_id`, optional
- `note`, optional
- `originating_meal_plan_entry_id`, optional
- `sort_order`
- `state`: `active`, `claimed`, `purchased`, or `removed`
- `claimed_by_session_id`, nullable
- `purchased_at`, nullable

### ShoppingSession

Groups items handled by one member during one trip.

- `id`
- `household_id`
- `member_id`
- `started_at`
- `finished_at`, nullable
- `receipt_total_cents`, optional
- `receipt_path`, optional
- `draft_expense_id`, optional

### ShoppingSessionItem

Links an item to the shopping session that claimed and purchased it.

Shopping invariants:

- A member has at most one active shopping session.
- An active item can be claimed by at most one active session.
- Claimed items remain visible to the other member.
- Potential duplicate items suggest merging; quantities or units are never silently combined.
- Finishing a session moves purchased items to 30-day recent history and may create one unposted expense draft.
- Receipt total and shared expense amount are independent values.
- Item-level prices are not represented.

## Money aggregate

Financial history is append-only. Mutable drafts exist outside the ledger and do not affect balances.

### FinancialEvent

- `id`
- `household_id`
- `type`: `opening_balance`, `expense`, `refund`, `settlement`, `reversal`, or `replacement`
- `occurred_on`
- `created_at`
- `created_by_member_id`
- `description`
- `amount_cents`, a non-negative CHF integer
- `category_id`, optional
- `note`, optional
- `receipt_path`, optional
- `shopping_session_id`, optional
- `related_event_id`, optional
- `idempotency_key`

### FinancialAllocation

Records each member's allocation for an expense-like event.

- `financial_event_id`
- `member_id`
- `allocated_cents`

### LedgerEntry

The authoritative double-entry result of posting a financial event.

- `financial_event_id`
- `member_id`
- `receivable_delta_cents`

For each event, member deltas sum to zero. A positive household balance means the member is owed money; a negative balance means the member owes money.

### ExpenseDraft

A mutable proposed expense created by a recurring rule or finished shopping session.

- `id`
- `household_id`
- `source_kind`: `recurring` or `shopping`
- `description`
- `amount_cents`, optional until known
- `payer_member_id`, optional until known
- `proposed_allocations`
- `occurred_on`
- `status`: `pending`, `posted`, or `dismissed`

### RecurringExpenseRule

Creates weekly or fixed-date monthly expense drafts and never posts directly to the ledger.

Financial invariants:

- All monetary values are integer CHF centimes.
- An expense has exactly one payer and allocations whose sum equals its amount.
- Equal division assigns an odd-cent remainder to the payer's own allocation.
- Manual expenses post immediately through an authoritative transactional command.
- Drafts do not affect balances.
- Refunds link to their original expense and post reversing economic value without rewriting history.
- Full and partial settlements are external-transfer events, not in-app payments.
- Corrections atomically post a reversal and, when needed, a replacement.
- Every event produces ledger entries that sum to zero.
- The displayed balance is always derived from ledger entries and cannot be edited directly.
- Repeated commands with the same idempotency key post one event.

## Collaboration and notification aggregate

### ActivityEvent

Retained for 90 days and created for routine definition or schedule changes, completions, skips, meal-plan changes, shopping-session completion, and every financial mutation.

### InboxNotification

A durable in-app notification for one member. Partner notifications cover financial mutations, assignments or schedule changes affecting the recipient, shopping-session completion, and direct swaps. The actor is not notified of their own action.

### PushSubscription

Stores one member's Web Push subscription for an installed device. Push is optional and has no email fallback.

### NotificationPreference

- per-member digest enabled state and local delivery time
- per-routine reminder enabled state and due-day local time

The digest includes overdue and due-today routines, today's meal and preparation work, whether groceries are active, and pending financial drafts. It excludes the current owed balance.

## Cross-domain commands

### Complete occurrence

Closes one occurrence, records the actual member, writes activity, computes the next occurrence when required, and optionally removes a matching inbox reminder in one transaction.

### Finish shopping

Closes one shopping session, marks its items purchased, retains their meal provenance, and optionally creates one mutable grocery expense draft. No ledger event is created until that draft is confirmed.

### Confirm expense draft

Validates amount, payer, exact allocation, and idempotency key; posts the financial event and ledger entries atomically; marks the draft posted; writes activity; and notifies the other member.

### Correct financial event

Validates that the target belongs to the household, posts a reversal and optional replacement atomically, records the relationship between events, writes activity, and notifies the other member.

## Authorization boundary

All tenant-owned rows carry or derive a `household_id`. Database Row Level Security grants access only when the authenticated user has a matching `HouseholdMember` row. Trusted commands recheck membership inside the transaction. The Supabase administrator secret is limited to local enrollment and recovery commands and never enters Vercel client or runtime configuration.

## Retention

- Financial events and ledger entries: life of the household.
- Routine occurrences and completions: life of the household.
- Purchased groceries: 30 days.
- General activity: 90 days.
- Archived definitions: retained while the household exists.
- Attachments: retained with their parent record unless the household is reset.
- Backups and on-demand export: excluded from version one.
