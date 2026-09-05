declare const householdIdBrand: unique symbol;
declare const memberIdBrand: unique symbol;
declare const partnerRecipientIdBrand: unique symbol;

export type HouseholdId = string & {
  readonly [householdIdBrand]: "HouseholdId";
};

export type MemberId = string & {
  readonly [memberIdBrand]: "MemberId";
};

export type PartnerRecipientId = MemberId & {
  readonly [partnerRecipientIdBrand]: "PartnerRecipientId";
};

export function asHouseholdId(value: string): HouseholdId {
  if (value.length === 0) {
    throw new Error("HouseholdId must be a non-empty string");
  }

  return value as HouseholdId;
}

export function asMemberId(value: string): MemberId {
  if (value.length === 0) {
    throw new Error("MemberId must be a non-empty string");
  }

  return value as MemberId;
}

export type ActivityKind =
  | "routine_created"
  | "routine_updated"
  | "occurrence_completed"
  | "occurrence_skipped"
  | "occurrence_rescheduled"
  | "routine_paused"
  | "routine_unpaused"
  | "routine_archived"
  | "meal_plan_entry_created"
  | "meal_plan_entry_updated"
  | "meal_plan_entry_removed"
  | "shopping_session_finished"
  | "opening_balance_established"
  | "expense_posted"
  | "expense_draft_confirmed"
  | "expense_draft_dismissed"
  | "refund_posted"
  | "settlement_recorded"
  | "financial_event_corrected"
  | "recurring_expense_rule_created"
  | "recurring_expense_rule_updated"
  | "recurring_drafts_generated"
  | "direct_swap_completed";

export type NotifyRule =
  | {
      outcome: "activity_only";
      reason: "completion_or_skip" | "ordinary_meal_edit" | "non_partner_noise";
    }
  | {
      outcome: "notify_other_member";
      hook?: "direct_swap";
    }
  | {
      outcome: "notify_affected_members";
      requiresAffectMemberIds: true;
    };

export type PartnerNotifyCatalog = Readonly<Record<ActivityKind, NotifyRule>>;

export type PartnerNotifyContext = {
  householdId: HouseholdId;
  actorMemberId: MemberId;
  memberIds: readonly [MemberId, MemberId];
  activityKind: ActivityKind;
  affectMemberIds: readonly MemberId[];
};

export type InboxKind =
  "partner_notice" | "routine_reminder" | "household_digest";

export type InboxNotification = {
  id: string;
  householdId: HouseholdId;
  recipientMemberId: MemberId;
  actorMemberId: MemberId | null;
  kind: InboxKind;
  activityKind: ActivityKind | null;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type DigestBody = {
  overdueRoutines: readonly {
    occurrenceId: string;
    title: string;
    dueDate: string;
  }[];
  dueTodayRoutines: readonly {
    occurrenceId: string;
    title: string;
    dueDate: string;
  }[];
  todaysMeals: readonly {
    entryId: string;
    slot: "breakfast" | "lunch" | "dinner";
    title: string;
  }[];
  preparationTasks: readonly {
    id: string;
    title: string;
  }[];
  groceriesActive: boolean;
  pendingFinancialDrafts: readonly {
    draftId: string;
    description: string;
    amountCents: number;
  }[];
};

export type DigestSourceSnapshot = {
  asOfDate: string;
  overdueRoutines: DigestBody["overdueRoutines"];
  dueTodayRoutines: DigestBody["dueTodayRoutines"];
  todaysMeals: DigestBody["todaysMeals"];
  preparationTasks: DigestBody["preparationTasks"];
  groceriesActive: boolean;
  pendingFinancialDrafts: DigestBody["pendingFinancialDrafts"];
};

export type DigestPreference = {
  householdId: HouseholdId;
  memberId: MemberId;
  enabled: boolean;
  localTime: string;
};

export type JobKind =
  | "deliver_due_reminders"
  | "deliver_member_digests"
  | "ensure_due_occurrences"
  | "generate_recurring_drafts_cron"
  | "retain_activity_events"
  | "retain_purchased_groceries"
  | "drain_push_outbox";

declare const jobScheduleKeyBrand: unique symbol;

export type JobScheduleKey = string & {
  readonly [jobScheduleKeyBrand]: "JobScheduleKey";
};

export type ParsedScheduleKey = {
  jobKind: JobKind;
  scope: string;
  slot: string;
};

export type JobClaimStatus = "started" | "succeeded" | "failed";

export type JobClaim = {
  scheduleKey: JobScheduleKey;
  jobKind: JobKind;
  status: JobClaimStatus;
  attemptCount: number;
  result: Record<string, unknown> | null;
  lastError: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type JobClaimDecision =
  | {
      kind: "run";
      claim: JobClaim;
    }
  | {
      kind: "already_succeeded";
      claim: JobClaim;
    }
  | {
      kind: "retry_failed";
      claim: JobClaim;
    };

export type AppSurface =
  "today" | "plan" | "groceries" | "money" | "home" | "inbox";

export type WatchedTable =
  | "inbox_notifications"
  | "routine_occurrences"
  | "routines"
  | "meal_plan_entries"
  | "meal_definitions"
  | "meal_grocery_templates"
  | "grocery_items"
  | "shopping_sessions"
  | "expense_drafts"
  | "financial_events"
  | "activity_events";
