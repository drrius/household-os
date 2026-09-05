export type InboxNotificationKind =
  "partner_notice" | "routine_reminder" | "household_digest" | "device_test";

export type PushInboxNotification = {
  id: string;
  test_subscription_id?: string;
  kind: InboxNotificationKind;
  activity_kind: string | null;
  entity_type: string | null;
};

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  notificationId: string;
  icon: "/icons/icon-192.png";
};

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

function urlForNotification(notification: PushInboxNotification): string {
  switch (notification.kind) {
    case "device_test":
      return "/home/notifications";
    case "routine_reminder":
    case "household_digest":
      return "/";
    case "partner_notice":
      if (notification.entity_type === "shopping_session") {
        return "/groceries";
      }
      if (
        notification.entity_type === "financial_event" ||
        notification.entity_type === "expense_draft" ||
        notification.activity_kind?.includes("expense") ||
        notification.activity_kind?.includes("settlement") ||
        notification.activity_kind?.includes("refund") ||
        notification.activity_kind === "opening_balance_established"
      ) {
        return "/money";
      }
      if (notification.entity_type === "meal_plan_entry") {
        return "/plan";
      }
      return "/home";
    default: {
      const _exhaustive: never = notification.kind;
      return _exhaustive;
    }
  }
}

export function buildPushPayload(
  notification: PushInboxNotification,
): PushPayload {
  switch (notification.kind) {
    case "device_test":
      return {
        title: "Household OS test",
        body: "Push is working on this device.",
        url: "/home/notifications",
        notificationId: notification.id,
        icon: "/icons/icon-192.png",
      };
    case "routine_reminder":
      return {
        title: "Routine reminder",
        body: "A routine reminder is waiting on Today.",
        url: urlForNotification(notification),
        notificationId: notification.id,
        icon: "/icons/icon-192.png",
      };
    case "household_digest":
      return {
        title: "Household digest",
        body: "Your household digest is ready.",
        url: urlForNotification(notification),
        notificationId: notification.id,
        icon: "/icons/icon-192.png",
      };
    case "partner_notice":
      return {
        title: partnerTitle(notification.activity_kind),
        body: "Your partner made a change that affects you.",
        url: urlForNotification(notification),
        notificationId: notification.id,
        icon: "/icons/icon-192.png",
      };
    default: {
      const _exhaustive: never = notification.kind;
      return _exhaustive;
    }
  }
}
