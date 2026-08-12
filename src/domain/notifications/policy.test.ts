import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { PARTNER_NOTIFY_CATALOG, resolvePartnerRecipients } from "./policy";
import {
  asHouseholdId,
  asMemberId,
  type ActivityKind,
  type PartnerNotifyContext,
} from "./types";

const ACTIVITY_KINDS = [
  "routine_created",
  "routine_updated",
  "occurrence_completed",
  "occurrence_skipped",
  "occurrence_rescheduled",
  "routine_paused",
  "routine_unpaused",
  "routine_archived",
  "meal_plan_entry_created",
  "meal_plan_entry_updated",
  "meal_plan_entry_removed",
  "shopping_session_finished",
  "opening_balance_established",
  "expense_posted",
  "expense_draft_confirmed",
  "expense_draft_dismissed",
  "refund_posted",
  "settlement_recorded",
  "financial_event_corrected",
  "recurring_expense_rule_created",
  "recurring_expense_rule_updated",
  "recurring_drafts_generated",
  "direct_swap_completed",
] as const satisfies readonly ActivityKind[];

const householdId = asHouseholdId("household");
const memberA = asMemberId("member-a");
const memberB = asMemberId("member-b");
const outsider = asMemberId("outsider");
const memberIds = [memberA, memberB] as const;

function context(
  activityKind: ActivityKind,
  actorMemberId = memberA,
  affectMemberIds: PartnerNotifyContext["affectMemberIds"] = [],
): PartnerNotifyContext {
  return {
    householdId,
    actorMemberId,
    memberIds,
    activityKind,
    affectMemberIds,
  };
}

describe("PARTNER_NOTIFY_CATALOG", () => {
  it("has exactly one policy for every activity kind", () => {
    expect(Object.keys(PARTNER_NOTIFY_CATALOG).sort()).toEqual(
      [...ACTIVITY_KINDS].sort(),
    );
  });

  it("fails loudly when a runtime catalog entry is missing", () => {
    const incompleteCatalog = { ...PARTNER_NOTIFY_CATALOG };
    Reflect.deleteProperty(incompleteCatalog, "expense_posted");

    expect(() =>
      resolvePartnerRecipients(incompleteCatalog, context("expense_posted")),
    ).toThrow("Missing partner notification policy");
  });
});

describe("resolvePartnerRecipients", () => {
  it("returns no recipients for activity-only events", () => {
    expect(
      resolvePartnerRecipients(
        PARTNER_NOTIFY_CATALOG,
        context("occurrence_completed"),
      ),
    ).toEqual([]);
  });

  it("returns the other household member for partner events", () => {
    expect(
      resolvePartnerRecipients(
        PARTNER_NOTIFY_CATALOG,
        context("expense_posted"),
      ),
    ).toEqual([memberB]);

    expect(
      resolvePartnerRecipients(
        PARTNER_NOTIFY_CATALOG,
        context("direct_swap_completed", memberB),
      ),
    ).toEqual([memberA]);
  });

  it("returns unique affected household members except the actor", () => {
    expect(
      resolvePartnerRecipients(
        PARTNER_NOTIFY_CATALOG,
        context("routine_updated", memberA, [
          memberA,
          memberB,
          outsider,
          memberB,
        ]),
      ),
    ).toEqual([memberB]);
  });

  it("returns no affected recipients when filtering removes every member", () => {
    expect(
      resolvePartnerRecipients(
        PARTNER_NOTIFY_CATALOG,
        context("occurrence_rescheduled", memberA, [memberA, outsider]),
      ),
    ).toEqual([]);
  });

  it("never includes the actor", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ACTIVITY_KINDS),
        fc.boolean(),
        fc.array(fc.constantFrom(memberA, memberB, outsider), {
          maxLength: 8,
        }),
        (activityKind, actorIsFirst, affectMemberIds) => {
          const actorMemberId = actorIsFirst ? memberA : memberB;
          const recipients = resolvePartnerRecipients(
            PARTNER_NOTIFY_CATALOG,
            context(activityKind, actorMemberId, affectMemberIds),
          );

          expect(recipients).not.toContain(actorMemberId);
        },
      ),
    );
  });
});
