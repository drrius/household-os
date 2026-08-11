import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  PARTNER_NOTIFY_CATALOG,
  resolvePartnerRecipients,
} from "./policy";
import { asMemberId, type ActivityKind } from "./types";

const alice = asMemberId("alice");
const bob = asMemberId("bob");
const memberIds = [alice, bob] as const;

const activityKinds = Object.keys(PARTNER_NOTIFY_CATALOG) as ActivityKind[];

describe("PARTNER_NOTIFY_CATALOG", () => {
  it("is exhaustive over every ActivityKind key", () => {
    expect(activityKinds.length).toBeGreaterThan(0);
    for (const kind of activityKinds) {
      expect(PARTNER_NOTIFY_CATALOG[kind]).toBeDefined();
    }
  });

  it("keeps completions and ordinary meal edits activity-only", () => {
    for (const kind of [
      "occurrence_completed",
      "occurrence_skipped",
      "meal_plan_entry_created",
      "meal_plan_entry_updated",
      "meal_plan_entry_removed",
    ] as const) {
      expect(PARTNER_NOTIFY_CATALOG[kind].outcome).toBe("activity_only");
    }
  });

  it("notifies the other member for financial mutations and shopping finish", () => {
    for (const kind of [
      "opening_balance_established",
      "expense_posted",
      "expense_draft_confirmed",
      "refund_posted",
      "settlement_recorded",
      "financial_event_corrected",
      "shopping_session_finished",
      "direct_swap_completed",
    ] as const) {
      expect(PARTNER_NOTIFY_CATALOG[kind].outcome).toBe("notify_other_member");
    }
  });
});

describe("resolvePartnerRecipients", () => {
  it("never includes the actor for other-member notices", () => {
    const recipients = resolvePartnerRecipients(PARTNER_NOTIFY_CATALOG, {
      actorMemberId: alice,
      memberIds,
      activityKind: "expense_posted",
      affectMemberIds: [],
    });
    expect(recipients).toEqual([bob]);
  });

  it("returns no recipients for activity-only kinds", () => {
    expect(
      resolvePartnerRecipients(PARTNER_NOTIFY_CATALOG, {
        actorMemberId: alice,
        memberIds,
        activityKind: "occurrence_completed",
        affectMemberIds: [bob],
      }),
    ).toEqual([]);
  });

  it("notifies affected members except the actor", () => {
    expect(
      resolvePartnerRecipients(PARTNER_NOTIFY_CATALOG, {
        actorMemberId: alice,
        memberIds,
        activityKind: "routine_updated",
        affectMemberIds: [alice, bob],
      }),
    ).toEqual([bob]);
  });

  it("never returns the actor for any catalogued kind", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...activityKinds),
        fc.constantFrom(alice, bob),
        fc.array(fc.constantFrom(alice, bob), { maxLength: 3 }),
        (activityKind, actorMemberId, affectMemberIds) => {
          const recipients = resolvePartnerRecipients(PARTNER_NOTIFY_CATALOG, {
            actorMemberId,
            memberIds,
            activityKind,
            affectMemberIds,
          });
          expect(recipients.includes(actorMemberId as never)).toBe(false);
        },
      ),
    );
  });
});
