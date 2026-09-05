import { z } from "zod";
export const inboxRowSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["partner_notice", "routine_reminder", "household_digest"]),
  activity_kind: z.string().nullable(),
  entity_type: z.string().nullable(),
  entity_id: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()).default({}),
  read_at: z.string().nullable(),
  created_at: z.iso.datetime({ offset: true }),
});

export type InboxRow = z.infer<typeof inboxRowSchema>;
function partnerTitle(activityKind: string | null): string {
  switch (activityKind) {
    case "expense_posted":
      return "Expense posted";
    case "expense_draft_confirmed":
      return "Draft confirmed";
    case "expense_draft_dismissed":
      return "Draft dismissed";
    case "refund_posted":
      return "Refund posted";
    case "settlement_recorded":
      return "Settlement recorded";
    case "financial_event_corrected":
      return "Ledger correction";
    case "opening_balance_established":
      return "Opening balance set";
    case "shopping_session_finished":
      return "Shopping finished";
    case "direct_swap_completed":
      return "Direct swap";
    case "occurrence_rescheduled":
      return "Routine rescheduled";
    case "routine_created":
      return "Routine created";
    case "routine_updated":
      return "Routine updated";
    default:
      return "Household update";
  }
}

function hrefForInbox(row: InboxRow, targetAvailable: boolean): string {
  switch (row.kind) {
    case "routine_reminder":
      return "/";
    case "household_digest":
      return "/";
    case "partner_notice": {
      if (
        targetAvailable &&
        row.entity_id &&
        z.uuid().safeParse(row.entity_id).success
      ) {
        if (row.entity_type === "routine")
          return `/home/routines/${row.entity_id}/edit`;
        if (row.entity_type === "meal_plan_entry")
          return `/plan/meals/${row.entity_id}`;
        if (row.entity_type === "expense_draft")
          return `/money/expenses/new?draft=${row.entity_id}`;
      }
      if (row.entity_type === "meal_plan_entry") return "/plan";
      if (row.entity_type === "shopping_session") {
        return "/groceries";
      }
      if (
        row.entity_type === "financial_event" ||
        row.entity_type === "expense_draft" ||
        row.activity_kind?.includes("expense") ||
        row.activity_kind?.includes("settlement") ||
        row.activity_kind?.includes("refund") ||
        row.activity_kind === "opening_balance_established"
      ) {
        return "/money";
      }
      return "/home";
    }
    default: {
      const _exhaustive: never = row.kind;
      return _exhaustive;
    }
  }
}

function bodyForInbox(row: InboxRow): string {
  switch (row.kind) {
    case "routine_reminder":
      return "A routine reminder is waiting on Today.";
    case "household_digest":
      return "Your household digest is ready.";
    case "partner_notice":
      return "Your partner made a change that affects you.";
    default: {
      const _exhaustive: never = row.kind;
      return _exhaustive;
    }
  }
}

function titleForInbox(row: InboxRow): string {
  switch (row.kind) {
    case "routine_reminder":
      return "Routine reminder";
    case "household_digest":
      return "Household digest";
    case "partner_notice":
      return partnerTitle(row.activity_kind);
    default: {
      const _exhaustive: never = row.kind;
      return _exhaustive;
    }
  }
}

function kindLabel(row: InboxRow): string {
  switch (row.kind) {
    case "routine_reminder":
      return "Reminder";
    case "household_digest":
      return "Digest";
    case "partner_notice":
      return "Partner";
    default: {
      const _exhaustive: never = row.kind;
      return _exhaustive;
    }
  }
}

export function presentInboxRow(row: InboxRow, targetAvailable = false) {
  return {
    id: row.id,
    title: titleForInbox(row),
    body: bodyForInbox(row),
    href: hrefForInbox(row, targetAvailable),
    kindLabel: kindLabel(row),
    read: row.read_at !== null,
  };
}

export function emptyInboxCopy(input: {
  older: boolean;
  unreadOnly: boolean;
  totalCount: number;
  unreadCount: number;
}) {
  if (input.older)
    return {
      title: "No older messages",
      body: "There are no more messages in this view. Return to the latest messages to check for updates.",
    };
  if (input.unreadCount > 0)
    return {
      title: "Your inbox changed",
      body: "New messages are available. Open Unread again to refresh this view.",
    };
  if (input.unreadOnly && input.totalCount > 0)
    return {
      title: "You're caught up",
      body: "You have read all your messages. Your history is still in All.",
    };
  return {
    title: "Nothing here yet",
    body: "Partner updates, reminders, and digests will appear here, even with push turned off.",
  };
}
