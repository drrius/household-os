import type {
  MemberId,
  NotifyRule,
  PartnerNotifyCatalog,
  PartnerNotifyContext,
  PartnerRecipientId,
} from "./types";

export const PARTNER_NOTIFY_CATALOG = {
  project_record_changed: {
    outcome: "activity_only",
    reason: "non_partner_noise",
  },
  project_task_assigned: {
    outcome: "notify_affected_members",
    requiresAffectMemberIds: true,
  },
  routine_created: {
    outcome: "activity_only",
    reason: "non_partner_noise",
  },
  routine_updated: {
    outcome: "notify_affected_members",
    requiresAffectMemberIds: true,
  },
  occurrence_completed: {
    outcome: "activity_only",
    reason: "completion_or_skip",
  },
  occurrence_skipped: {
    outcome: "activity_only",
    reason: "completion_or_skip",
  },
  occurrence_rescheduled: {
    outcome: "notify_affected_members",
    requiresAffectMemberIds: true,
  },
  routine_paused: {
    outcome: "activity_only",
    reason: "non_partner_noise",
  },
  routine_unpaused: {
    outcome: "activity_only",
    reason: "non_partner_noise",
  },
  routine_archived: {
    outcome: "activity_only",
    reason: "non_partner_noise",
  },
  meal_plan_entry_created: {
    outcome: "activity_only",
    reason: "ordinary_meal_edit",
  },
  meal_plan_entry_updated: {
    outcome: "activity_only",
    reason: "ordinary_meal_edit",
  },
  meal_plan_entry_removed: {
    outcome: "activity_only",
    reason: "ordinary_meal_edit",
  },
  shopping_session_finished: {
    outcome: "notify_other_member",
  },
  opening_balance_established: {
    outcome: "notify_other_member",
  },
  expense_posted: {
    outcome: "notify_other_member",
  },
  expense_draft_confirmed: {
    outcome: "notify_other_member",
  },
  expense_draft_dismissed: {
    outcome: "activity_only",
    reason: "non_partner_noise",
  },
  refund_posted: {
    outcome: "notify_other_member",
  },
  settlement_recorded: {
    outcome: "notify_other_member",
  },
  financial_event_corrected: {
    outcome: "notify_other_member",
  },
  recurring_expense_rule_created: {
    outcome: "activity_only",
    reason: "non_partner_noise",
  },
  recurring_expense_rule_updated: {
    outcome: "activity_only",
    reason: "non_partner_noise",
  },
  recurring_drafts_generated: {
    outcome: "activity_only",
    reason: "non_partner_noise",
  },
  direct_swap_completed: {
    outcome: "notify_other_member",
    hook: "direct_swap",
  },
} as const satisfies PartnerNotifyCatalog;

function toPartnerRecipientId(
  memberId: MemberId,
  actorMemberId: MemberId,
): PartnerRecipientId {
  if (memberId === actorMemberId) {
    throw new Error("The actor cannot be a partner notification recipient");
  }

  return memberId as PartnerRecipientId;
}

function otherPartnerRecipient(
  memberIds: readonly [MemberId, MemberId],
  actorMemberId: MemberId,
): PartnerRecipientId {
  const [firstMemberId, secondMemberId] = memberIds;

  if (firstMemberId === secondMemberId) {
    throw new Error("Partner notifications require two distinct members");
  }

  if (actorMemberId === firstMemberId) {
    return toPartnerRecipientId(secondMemberId, actorMemberId);
  }

  if (actorMemberId === secondMemberId) {
    return toPartnerRecipientId(firstMemberId, actorMemberId);
  }

  throw new Error("The actor must be one of the household members");
}

function affectedPartnerRecipients(
  affectMemberIds: readonly MemberId[],
  memberIds: readonly [MemberId, MemberId],
  actorMemberId: MemberId,
): PartnerRecipientId[] {
  const householdMemberIds = new Set<MemberId>(memberIds);
  const recipientIds = new Set<MemberId>();

  for (const memberId of affectMemberIds) {
    if (
      memberId !== actorMemberId &&
      householdMemberIds.has(memberId) &&
      !recipientIds.has(memberId)
    ) {
      recipientIds.add(memberId);
    }
  }

  return Array.from(recipientIds, (memberId) =>
    toPartnerRecipientId(memberId, actorMemberId),
  );
}

export function resolvePartnerRecipients(
  catalog: PartnerNotifyCatalog,
  context: PartnerNotifyContext,
): PartnerRecipientId[] {
  const rule: NotifyRule | undefined = catalog[context.activityKind];

  if (rule === undefined) {
    throw new Error(
      `Missing partner notification policy for ${context.activityKind}`,
    );
  }

  switch (rule.outcome) {
    case "activity_only":
      return [];
    case "notify_other_member":
      return [otherPartnerRecipient(context.memberIds, context.actorMemberId)];
    case "notify_affected_members":
      return affectedPartnerRecipients(
        context.affectMemberIds,
        context.memberIds,
        context.actorMemberId,
      );
    default: {
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}
