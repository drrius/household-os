import { expect, it } from "vitest";
import fc from "fast-check";
import { parseProjectForm, parseTaskForm, safeBookingUrl } from "./forms";

function projectForm(fields: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    id: "00000000-0000-4000-8000-000000000010",
    kind: "trip",
    title: "Autumn away",
    ...fields,
  }))
    form.set(key, value);
  return form;
}

it("allows undecided dates but rejects an inverted range", () => {
  expect(parseProjectForm(projectForm()).fields.starts_on).toBeNull();
  expect(() =>
    parseProjectForm(
      projectForm({ starts_on: "2026-09-10", ends_on: "2026-09-09" }),
    ),
  ).toThrow("end date");
  expect(() =>
    parseProjectForm(projectForm({ starts_on: "2026-02-30" })),
  ).toThrow();
});

it("parses planning amounts to exact integer centimes", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 999999999 }), (cents) => {
      const amount = `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
      expect(
        parseProjectForm(projectForm({ budget: amount })).fields.budget_cents,
      ).toBe(cents);
    }),
  );
  expect(() => parseProjectForm(projectForm({ budget: "4.001" }))).toThrow(
    "CHF amount",
  );
  expect(() => parseProjectForm(projectForm({ budget: "-1" }))).toThrow(
    "CHF amount",
  );
});

it("rejects invalid member identities and retains task context", () => {
  const id = "00000000-0000-4000-8000-000000000020";
  expect(
    parseTaskForm(
      projectForm({
        project_id: id,
        section: "Packing",
        assigned_member_id: "",
      }),
    ).fields,
  ).toMatchObject({
    project_id: id,
    section: "Packing",
    assigned_member_id: null,
  });
  expect(() =>
    parseTaskForm(
      projectForm({ project_id: id, assigned_member_id: "someone" }),
    ),
  ).toThrow();
});

it("accepts ordinary booking links and rejects executable or credentialed links", () => {
  expect(safeBookingUrl("https://example.com/hotel?room=2")).toBe(
    "https://example.com/hotel?room=2",
  );
  for (const link of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "https://user:password@example.com",
  ])
    expect(() => safeBookingUrl(link)).toThrow("complete http");
});
