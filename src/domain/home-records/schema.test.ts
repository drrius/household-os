import { expect, it } from "vitest";
import fc from "fast-check";
import { parseRecord } from "./schema";
import {
  noticeDeadline,
  validRecordDate,
  deadlineLabel,
  needsAttention,
} from "./dates";
const id = "f0000000-0000-4000-8000-000000000001";
it("requires names, real dates, and warranties after purchase", () => {
  expect(() => parseRecord("inventory", { title: "" })).toThrow();
  expect(() =>
    parseRecord("inventory", {
      title: "Dishwasher",
      purchased_on: "2026-02-30",
    }),
  ).toThrow();
  expect(() =>
    parseRecord("inventory", {
      title: "Dishwasher",
      purchased_on: "2026-09-05",
      warranty_until: "2026-09-04",
    }),
  ).toThrow();
  expect(validRecordDate("2028-02-29")).toBe(true);
});
it("never accepts command-owned or identity fields in editable payloads", () => {
  expect(
    parseRecord("decisions", {
      title: "Weekend plans",
      status: "decided",
      converted_project_id: id,
      household_id: id,
    }),
  ).toEqual({ title: "Weekend plans", notes: "", project_id: null });
  expect(
    parseRecord("options", { title: "Train", decision_id: id, chosen: true }),
  ).not.toHaveProperty("chosen");
});
it("keeps a document attached to at most one parent and rejects script URLs", () => {
  expect(() =>
    parseRecord("documents", {
      title: "Manual",
      file_path: "path",
      asset_id: id,
      commitment_id: id,
    }),
  ).toThrow();
  expect(() =>
    parseRecord("contacts", {
      name: "Repairs",
      website: "javascript:alert(1)",
    }),
  ).toThrow();
  expect(() =>
    parseRecord("options", {
      title: "Idea",
      decision_id: id,
      website: "https://",
    }),
  ).toThrow();
});
it("parses expected costs into exact centimes without posting money", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 100000000 }), (cents) => {
      const value = `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
      expect(
        parseRecord("options", {
          title: "Option",
          decision_id: id,
          estimated_amount_cents: value,
        }),
      ).toMatchObject({ estimated_amount_cents: cents });
    }),
  );
  expect(() =>
    parseRecord("options", {
      title: "Option",
      decision_id: id,
      estimated_amount_cents: "0.001",
    }),
  ).toThrow();
});
it("derives calendar notice deadlines across leap days, years and DST", () => {
  expect(noticeDeadline("2028-03-01", 1)).toBe("2028-02-29");
  expect(noticeDeadline("2027-01-01", 31)).toBe("2026-12-01");
  expect(noticeDeadline("2026-03-30", 1)).toBe("2026-03-29");
  fc.assert(
    fc.property(
      fc.integer({ min: 11000, max: 40000 }),
      fc.integer({ min: 0, max: 730 }),
      (day, notice) => {
        const renewal = new Date(day * 86400000).toISOString().slice(0, 10);
        const deadline = noticeDeadline(renewal, notice);
        expect(validRecordDate(deadline)).toBe(true);
        expect(Date.parse(renewal) - Date.parse(deadline)).toBe(
          notice * 86400000,
        );
      },
    ),
  );
  expect(deadlineLabel("2026-09-05", "2026-09-05")).toBe("Today");
  expect(deadlineLabel("2026-09-06", "2026-09-05")).toBe("Tomorrow");
});

it("highlights expiring warranties and overdue notice deadlines, excluding ended commitments", () => {
  expect(needsAttention({ warranty: "2026-09-30" }, "2026-09-05")).toBe(true);
  expect(needsAttention({ warranty: "2026-09-04" }, "2026-09-05")).toBe(false);
  expect(
    needsAttention({ renewal: "2026-09-20", noticeDays: 30 }, "2026-09-05"),
  ).toBe(true);
  expect(
    needsAttention(
      { renewal: "2026-09-20", noticeDays: 30, ended: true },
      "2026-09-05",
    ),
  ).toBe(false);
});
