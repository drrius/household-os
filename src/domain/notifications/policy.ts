import {
  asPartnerRecipientId,
  type ActivityKind,
  type MemberId,
  type PartnerRecipientId,
} from "./types";

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

export const PARTNER_NOTIFY_CATALOG: {
  readonly [K in ActivityKind]: NotifyRule;
} = {
  occurrence_completed: {
    outcome: "activity_only",
    reason: "completion_or_skip",
  },
  occurrence_skipped: {
    outcome: "activity_only",
    reason: "completion_or_skip",
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
  routine_created: {
    outcome: "activity_only",
    reason: "non_partner_noise",
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
  expense_draft_dismissed: {
    outcome: "activity_only",
    reason: "non_partner_noise",
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
  routine_updated: {
    outcome: "notify_affected_members",
    requiresAffectMemberIds: true,
  },
  occurrence_rescheduled: {
    outcome: "notify_affected_members",
    requiresAffectMemberIds: true,
  },
  shopping_session_finished: { outcome: "notify_other_member" },
  opening_balance_established: { outcome: "notify_other_member" },
  expense_posted: { outcome: "notify_other_member" },
  expense_draft_confirmed: { outcome: "notify_other_member" },
  refund_posted: { outcome: "notify_other_member" },
  settlement_recorded: { outcome: "notify_other_member" },
  financial_event_corrected: { outcome: "notify_other_member" },
  direct_swap_completed: {
    outcome: "notify_other_member",
    hook: "direct_swap",
  },
};

export type PartnerNotifyContext = {
  actorMemberId: MemberId;
  memberIds: readonly [MemberId, MemberId];
  activityKind: ActivityKind;
  affectMemberIds: readonly MemberId[];
};

function otherMember(
  memberIds: readonly [MemberId, MemberId],
  actorMemberId: MemberId,
): PartnerRecipientId {
  const [first, second] = memberIds;
  if (first === actorMemberId) {
    return asPartnerRecipientId(second);
  }
  if (second === actorMemberId) {
    return asPartnerRecipientId(first);
  }
  throw new Error("actor is not one of the household members");
}

export function resolvePartnerRecipients(
  catalog: typeof PARTNER_NOTIFY_CATALOG,
  ctx: PartnerNotifyContext,
): readonly PartnerRecipientId[] {
  const rule = catalog[ctx.activityKind];
  switch (rule.outcome) {
    case "activity_only":
      return [];
    case "notify_other_member":
      return [otherMember(ctx.memberIds, ctx.actorMemberId)];
    case "notify_affected_members": {
      const recipients: PartnerRecipientId[] = [];
      const seen = new Set<MemberId>();
      for (const memberId of ctx.affectMemberIds) {
        if (memberId === ctx.actorMemberId || seen.has(memberId)) {
          continue;
        }
        if (memberId !== ctx.memberIds[0] && memberId !== ctx.memberIds[1]) {
          continue;
        }
        seen.add(memberId);
        recipients.push(asPartnerRecipientId(memberId));
      }
      return recipients;
    }
    default: {
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}
