import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { parseMealPosition, parseMealPreparationForm } from "./meal";
import { mealDate, mealPlanHref } from "./meal-navigation";

function position(date: string, slot: string) {
  const form = new FormData();
  form.set("date", date);
  form.set("slot", slot);
  return form;
}

describe("meal planning context", () => {
  it("keeps the exact day while returning to its week", () => {
    expect(mealPlanHref("2027-01-03")).toBe(
      "/plan?week=2026-12-28&day=2027-01-03",
    );
  });
  it("rejects invalid dates and untrusted navigation destinations", () => {
    for (const value of [
      "2026-02-31",
      "//evil.invalid",
      "2026-01-01&next=https://evil.invalid",
      undefined,
    ])
      expect(mealDate(value, "2026-09-05")).toBe("2026-09-05");
  });
  it("anchors any weekly idea to Monday without changing ordinary dates", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 364 }), (offset) => {
        const date = new Date(Date.UTC(2026, 0, 1 + offset))
          .toISOString()
          .slice(0, 10);
        const idea = parseMealPosition(position(date, "idea"));
        expect(idea.slot).toBeNull();
        expect(new Date(`${idea.date}T12:00:00Z`).getUTCDay()).toBe(1);
        expect(Date.parse(date) - Date.parse(idea.date)).toBeGreaterThanOrEqual(
          0,
        );
        expect(Date.parse(date) - Date.parse(idea.date)).toBeLessThan(
          7 * 86400000,
        );
        expect(parseMealPosition(position(date, "dinner"))).toEqual({
          date,
          slot: "dinner",
        });
      }),
    );
  });
  it("rejects arbitrary meal slots", () => {
    expect(() =>
      parseMealPosition(position("2026-09-05", "midnight")),
    ).toThrow();
  });
  it("uses shared prep only when no member is assigned", () => {
    const form = new FormData();
    const id = "11111111-1111-4111-8111-111111111111";
    for (const [key, value] of Object.entries({
      entryId: id,
      title: "Thaw dough",
      dueOn: "2026-09-05",
      areaId: id,
      idempotencyKey: id,
    }))
      form.set(key, value);
    expect(parseMealPreparationForm(form).assignmentPolicy).toBe("shared");
    form.set("assignedMemberId", id);
    expect(parseMealPreparationForm(form).assignmentPolicy).toBe("assigned");
    form.set("assignedMemberId", "someone");
    expect(() => parseMealPreparationForm(form)).toThrow();
  });
});
