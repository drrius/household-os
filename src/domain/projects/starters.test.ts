import { describe, expect, it } from "vitest";
import { projectStarters, starterTasks, startersFor } from "./starters";

describe("starter checklists", () => {
  it("offers travel preparation only for trips", () => {
    expect(startersFor("project").map((item) => item.key)).toEqual(["project"]);
    expect(startersFor("trip").map((item) => item.key)).toEqual([
      "travel",
      "packing",
      "away",
    ]);
  });
  it("returns only selected canonical work and preserves request identities", () => {
    expect(
      starterTasks("trip", "packing", ["chargers"], {
        "packing:chargers": "stable-id",
      }),
    ).toEqual([
      {
        id: "stable-id",
        title: "Pack chargers and the right adapters",
        section: "Packing",
        notes: "",
      },
    ]);
  });
  it.each([
    ["project", "away", ["care"], { "away:care": "id" }],
    ["trip", "packing", [], {}],
    ["trip", "packing", ["forged"], { "packing:forged": "id" }],
    ["trip", "packing", ["chargers", "chargers"], { "packing:chargers": "id" }],
    ["trip", "packing", ["chargers"], {}],
  ] as const)(
    "rejects an invalid selection (%s, %s)",
    (kind, preset, keys, ids) => {
      expect(() => starterTasks(kind, preset, keys, ids)).toThrow();
    },
  );
  it("keeps catalog identities unique and every batch within the atomic limit", () => {
    for (const starter of projectStarters) {
      expect(new Set(starter.tasks.map(([key]) => key)).size).toBe(
        starter.tasks.length,
      );
      expect(starter.tasks.length).toBeLessThanOrEqual(20);
    }
  });
});
