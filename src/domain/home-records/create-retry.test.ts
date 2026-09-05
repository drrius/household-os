import fc from "fast-check";
import { expect, it } from "vitest";
import { matchesRecordCreation } from "./create-retry";
import { parseRecord, type RecordKind } from "./schema";
const parent = "f0000000-0000-4000-8000-000000000001";
const samples: [RecordKind, Record<string, string>][] = [
  [
    "inventory",
    { title: " Dishwasher ", notes: " Keep dry ", contact_id: parent },
  ],
  ["contacts", { name: " Repair shop ", notes: " Ask for Sam " }],
  [
    "commitments",
    {
      title: " Internet ",
      status: "active",
      notice_days: "30",
      billing_interval: "monthly",
      expected_amount_cents: "1234.50",
    },
  ],
  ["decisions", { title: " Holiday ", project_id: parent }],
  [
    "documents",
    {
      title: " Manual ",
      file_path: `${parent}/documents/${parent}.pdf`,
      asset_id: parent,
    },
  ],
  [
    "maintenance",
    { title: " Filter ", asset_id: parent, performed_on: "2026-09-05" },
  ],
  [
    "options",
    { title: " Train ", decision_id: parent, estimated_amount_cents: "85.25" },
  ],
  ["routines", { asset_id: parent, routine_id: parent }],
];
it.each(samples)(
  "accepts normalized %s retries and rejects changes to every submitted field",
  (kind, input) => {
    const values = parseRecord(kind, input);
    const existing = {
      archived_at: null,
      chosen: false,
      status: "considering",
      ...values,
    };
    expect(matchesRecordCreation(kind, values, existing)).toBe(true);
    for (const [key, value] of Object.entries(values)) {
      const changed = {
        ...existing,
        [key]:
          typeof value === "number"
            ? value + 1
            : value === null
              ? parent
              : `${value} changed`,
      };
      expect(matchesRecordCreation(kind, values, changed), key).toBe(false);
    }
    expect(
      matchesRecordCreation(kind, values, {
        ...existing,
        archived_at: "2026-09-05",
      }),
    ).toBe(false);
  },
);
it("compares integer centimes directly without treating them as CHF", () => {
  const values = parseRecord("options", samples[6]![1]);
  expect(values).toMatchObject({ estimated_amount_cents: 8525 });
  expect(
    matchesRecordCreation("options", values, {
      ...values,
      archived_at: null,
      chosen: false,
    }),
  ).toBe(true);
  expect(
    matchesRecordCreation("options", values, {
      ...values,
      archived_at: null,
      estimated_amount_cents: 852500,
      chosen: false,
    }),
  ).toBe(false);
});
it.each(["decided", "dismissed"])(
  "rejects a decision whose lifecycle advanced to %s",
  (status) => {
    const values = parseRecord("decisions", { title: "Holiday" });
    expect(
      matchesRecordCreation("decisions", values, {
        ...values,
        archived_at: null,
        status,
      }),
    ).toBe(false);
  },
);
it.each(["cancel_requested", "ended"])(
  "accepts an initially %s commitment but rejects later status changes",
  (status) => {
    const values = parseRecord("commitments", { ...samples[2]![1], status });
    expect(
      matchesRecordCreation("commitments", values, {
        ...values,
        archived_at: null,
      }),
    ).toBe(true);
    expect(
      matchesRecordCreation("commitments", values, {
        ...values,
        archived_at: null,
        status: "active",
      }),
    ).toBe(false);
  },
);

it("acknowledges option retries only while the choice remains in its initial state", () => {
  fc.assert(
    fc.property(fc.string(), fc.boolean(), (suffix, chosen) => {
      const values = { title: `Option ${suffix}`, decision_id: parent };
      expect(
        matchesRecordCreation("options", values, {
          ...values,
          archived_at: null,
          chosen,
        }),
      ).toBe(!chosen);
    }),
  );
});
