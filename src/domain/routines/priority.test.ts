import { describe, expect, it } from "vitest";

import { compareOverdueOccurrences } from "./priority";
import { asIsoDate } from "./types";

describe("compareOverdueOccurrences", () => {
  it("orders by care sensitivity then age", () => {
    const ordered = [
      { priority: "general" as const, dueDate: asIsoDate("2026-08-01") },
      { priority: "pet_care" as const, dueDate: asIsoDate("2026-08-08") },
      { priority: "cleaning" as const, dueDate: asIsoDate("2026-08-01") },
      { priority: "pet_care" as const, dueDate: asIsoDate("2026-08-01") },
    ].sort(compareOverdueOccurrences);

    expect(ordered.map((row) => `${row.priority}:${row.dueDate}`)).toEqual([
      "pet_care:2026-08-01",
      "pet_care:2026-08-08",
      "cleaning:2026-08-01",
      "general:2026-08-01",
    ]);
  });
});
