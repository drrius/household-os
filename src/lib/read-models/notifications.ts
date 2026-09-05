import { z } from "zod";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { formatZurichTimestamp } from "@/lib/ui/zurich-date";

const digestRowSchema = z.object({
  enabled: z.boolean(),
  local_time: z.string(),
});

const inboxRowSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["partner_notice", "routine_reminder", "household_digest"]),
  activity_kind: z.string().nullable(),
  entity_type: z.string().nullable(),
  entity_id: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  read_at: z.string().nullable(),
  created_at: z.string(),
});

export type DigestPreferenceView = {
  enabled: boolean;
  localTime: string;
};

export type InboxItemView = {
  id: string;
  title: string;
  body: string;
  href: string;
  kindLabel: string;
  createdLabel: string;
  read: boolean;
};

export type InboxFeed = {
  items: InboxItemView[];
  unreadCount: number;
  unreadIds: string[];
};

function normalizeLocalTime(value: string): string {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/u.exec(value.trim());
  if (!match) {
    return "08:00";
  }
  return `${match[1]}:${match[2]}`;
}

function partnerTitle(activityKind: string | null): string {
  switch (activityKind) {
    case "project_task_assigned":
      return "Task assigned to you";
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

function hrefForInbox(row: z.infer<typeof inboxRowSchema>): string {
  switch (row.kind) {
    case "routine_reminder":
      return "/";
    case "household_digest":
      return "/";
    case "partner_notice": {
      const projectId = z.uuid().safeParse(row.payload.project_id);
      if (row.entity_type === "project_task" && projectId.success)
        return `/plan/projects/${projectId.data}#tasks`;
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
      if (row.entity_type === "meal_plan_entry") {
        return "/plan";
      }
      return "/home";
    }
    default: {
      const _exhaustive: never = row.kind;
      return _exhaustive;
    }
  }
}

function bodyForInbox(row: z.infer<typeof inboxRowSchema>): string {
  switch (row.kind) {
    case "routine_reminder":
      return "A routine reminder is waiting on Today.";
    case "household_digest":
      return "Your household digest is ready.";
    case "partner_notice":
      if (
        row.activity_kind === "project_task_assigned" &&
        typeof row.payload.title === "string"
      )
        return row.payload.title;
      return "Your partner made a change that affects you.";
    default: {
      const _exhaustive: never = row.kind;
      return _exhaustive;
    }
  }
}

function titleForInbox(row: z.infer<typeof inboxRowSchema>): string {
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

function kindLabel(row: z.infer<typeof inboxRowSchema>): string {
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

export async function loadDigestPreference(): Promise<DigestPreferenceView> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_digest_preferences")
    .select("enabled, local_time")
    .eq("member_id", member.userId)
    .maybeSingle();
  if (error) {
    throw new Error(`Digest preference load failed: ${error.message}`);
  }
  if (!data) {
    return { enabled: false, localTime: "08:00" };
  }
  const parsed = digestRowSchema.parse(data);
  return {
    enabled: parsed.enabled,
    localTime: normalizeLocalTime(String(parsed.local_time)),
  };
}

export async function loadInboxFeed(limit = 40): Promise<InboxFeed> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const [feedResult, unreadCountResult, unreadIdsResult] = await Promise.all([
    supabase
      .from("inbox_notifications")
      .select(
        "id, kind, activity_kind, entity_type, entity_id, payload, read_at, created_at",
      )
      .eq("recipient_member_id", member.userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("inbox_notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_member_id", member.userId)
      .is("read_at", null),
    supabase
      .from("inbox_notifications")
      .select("id")
      .eq("recipient_member_id", member.userId)
      .is("read_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (feedResult.error) {
    throw new Error(`Inbox load failed: ${feedResult.error.message}`);
  }
  if (unreadCountResult.error) {
    throw new Error(
      `Inbox unread count failed: ${unreadCountResult.error.message}`,
    );
  }
  if (unreadIdsResult.error) {
    throw new Error(
      `Inbox unread ids failed: ${unreadIdsResult.error.message}`,
    );
  }

  const items = (feedResult.data ?? []).map((row) => {
    const parsed = inboxRowSchema.parse(row);
    return {
      id: parsed.id,
      title: titleForInbox(parsed),
      body: bodyForInbox(parsed),
      href: hrefForInbox(parsed),
      kindLabel: kindLabel(parsed),
      createdLabel: formatZurichTimestamp(parsed.created_at),
      read: parsed.read_at !== null,
    } satisfies InboxItemView;
  });

  const unreadIds = (unreadIdsResult.data ?? []).map((row) => {
    const id = Reflect.get(row, "id");
    if (typeof id !== "string" || id.length === 0) {
      throw new Error("Inbox unread id was missing");
    }
    return id;
  });

  return {
    items,
    unreadCount: unreadCountResult.count ?? unreadIds.length,
    unreadIds,
  };
}
