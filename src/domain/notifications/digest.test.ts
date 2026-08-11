import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  FORBIDDEN_DIGEST_KEYS,
  buildDigestBody,
  digestBodyContainsForbiddenKey,
} from "./digest";
import type { DigestSourceSnapshot } from "./types";

const sampleSource: DigestSourceSnapshot = {
  asOfDate: "2026-08-11",
  overdueRoutines: [
    {
      occurrenceId: "occ-1",
      title: "Dishes",
      dueDate: "2026-08-10",
    },
  ],
  dueTodayRoutines: [],
  todaysMeals: [
    {
      entryId: "meal-1",
      slot: "dinner",
      title: "Pasta",
    },
  ],
  preparationTasks: [],
  groceriesActive: true,
  pendingFinancialDrafts: [
    {
      draftId: "draft-1",
      description: "Groceries",
      amountCents: 2500,
    },
  ],
};

describe("buildDigestBody", () => {
  it("projects actionable work without inventing balance fields", () => {
    expect(buildDigestBody(sampleSource)).toEqual({
      overdueRoutines: sampleSource.overdueRoutines,
      dueTodayRoutines: sampleSource.dueTodayRoutines,
      todaysMeals: sampleSource.todaysMeals,
      preparationTasks: sampleSource.preparationTasks,
      groceriesActive: true,
      pendingFinancialDrafts: sampleSource.pendingFinancialDrafts,
    });
  });

  it("never emits forbidden balance keys", () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.array(
          fc.record({
            draftId: fc.uuid(),
            description: fc.string({ minLength: 1, maxLength: 40 }),
            amountCents: fc.integer({ min: 0, max: 1_000_000 }),
          }),
          { maxLength: 5 },
        ),
        (groceriesActive, pendingFinancialDrafts) => {
          const body = buildDigestBody({
            ...sampleSource,
            groceriesActive,
            pendingFinancialDrafts,
          });
          expect(digestBodyContainsForbiddenKey(body)).toBe(false);
          for (const key of FORBIDDEN_DIGEST_KEYS) {
            expect(Object.prototype.hasOwnProperty.call(body, key)).toBe(
              false,
            );
          }
        },
      ),
    );
  });
});
