import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { projectActivityChanges, projectActivityTitle } from "./activity";
const members = [
  { user_id: "member-a", display_name: "Alex" },
  { user_id: "member-b", display_name: "Sam" },
];
describe("project recovery history", () => {
  it("retains previous and cleared values with readable member names", () => {
    expect(
      projectActivityChanges(
        {
          before: { notes: "Call Tuesday", assigned_member_id: "member-a" },
          after: { notes: "", assigned_member_id: "member-b" },
          changed_fields: [
            "notes",
            "assigned_member_id",
            "created_by",
            "toString",
          ],
        },
        members,
      ),
    ).toEqual([
      { label: "Notes", before: "Call Tuesday", after: "Not set" },
      { label: "Assigned to", before: "Alex", after: "Sam" },
    ]);
  });
  it("formats CHF budget history exactly, including zero", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        (cents) => {
          const [change] = projectActivityChanges(
            {
              after: { budget_cents: cents },
              changed_fields: ["budget_cents"],
            },
            members,
          );
          const digits = BigInt(cents).toString().padStart(3, "0");
          expect(change?.after).toBe(
            `CHF ${digits.slice(0, -2)}.${digits.slice(-2)}`,
          );
        },
      ),
    );
    expect(
      projectActivityChanges(
        { after: { budget_cents: 0 }, changed_fields: ["budget_cents"] },
        members,
      )[0]?.after,
    ).toBe("CHF 0.00");
  });
  it("handles unknown historical fields and labels without exposing raw identities", () => {
    expect(
      projectActivityChanges(
        { before: [], after: null, changed_fields: ["household_id", null] },
        members,
      ),
    ).toEqual([]);
    expect(
      projectActivityChanges(
        {
          after: { assigned_member_id: "removed-member" },
          changed_fields: ["assigned_member_id"],
        },
        members,
      )[0]?.after,
    ).toBe("Former member");
    expect(
      projectActivityTitle({ operation: "restored", title: "Summer trip" }),
    ).toBe("restored Summer trip");
    expect(projectActivityTitle({ operation: {} })).toBe("updated a plan");
  });
});
