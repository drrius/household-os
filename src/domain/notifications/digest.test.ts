import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  buildDigestBody,
  FORBIDDEN_DIGEST_KEYS,
  isDigestBodyBalanceFree,
} from "./digest";
import type { DigestSourceSnapshot } from "./types";

const DIGEST_SOURCE_KEY_CATALOG = {
  asOfDate: true,
  overdueRoutines: true,
  dueTodayRoutines: true,
  todaysMeals: true,
  preparationTasks: true,
  groceriesActive: true,
  pendingFinancialDrafts: true,
} satisfies Record<keyof DigestSourceSnapshot, true>;

const routineArbitrary = fc.record({
  occurrenceId: fc.string(),
  title: fc.string(),
  dueDate: fc.string(),
});

const mealArbitrary = fc.record({
  entryId: fc.string(),
  slot: fc.constantFrom("breakfast", "lunch", "dinner"),
  title: fc.string(),
});

const preparationTaskArbitrary = fc.record({
  id: fc.string(),
  title: fc.string(),
});

const draftArbitrary = fc.record({
  draftId: fc.string(),
  description: fc.string(),
  amountCents: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
});

const sourceArbitrary: fc.Arbitrary<DigestSourceSnapshot> = fc.record({
  asOfDate: fc.string(),
  overdueRoutines: fc.array(routineArbitrary),
  dueTodayRoutines: fc.array(routineArbitrary),
  todaysMeals: fc.array(mealArbitrary),
  preparationTasks: fc.array(preparationTaskArbitrary),
  groceriesActive: fc.boolean(),
  pendingFinancialDrafts: fc.array(draftArbitrary),
});

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nestedKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(nestedKeys);
  }

  if (!isUnknownRecord(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [
    key,
    ...nestedKeys(nestedValue),
  ]);
}

describe("buildDigestBody", () => {
  it("projects the allowed digest fields", () => {
    const source: DigestSourceSnapshot = {
      asOfDate: "2026-08-11",
      overdueRoutines: [
        {
          occurrenceId: "overdue",
          title: "Water plants",
          dueDate: "2026-08-10",
        },
      ],
      dueTodayRoutines: [],
      todaysMeals: [
        {
          entryId: "meal",
          slot: "dinner",
          title: "Pasta",
        },
      ],
      preparationTasks: [{ id: "prep", title: "Make sauce" }],
      groceriesActive: true,
      pendingFinancialDrafts: [
        {
          draftId: "draft",
          description: "Groceries",
          amountCents: 4_250,
        },
      ],
    };

    expect(buildDigestBody(source)).toEqual({
      overdueRoutines: source.overdueRoutines,
      dueTodayRoutines: source.dueTodayRoutines,
      todaysMeals: source.todaysMeals,
      preparationTasks: source.preparationTasks,
      groceriesActive: true,
      pendingFinancialDrafts: source.pendingFinancialDrafts,
    });
    expect(Object.keys(source).sort()).toEqual(
      Object.keys(DIGEST_SOURCE_KEY_CATALOG).sort(),
    );
  });

  it("recognizes forbidden nested digest keys", () => {
    expect(
      isDigestBodyBalanceFree({
        pendingFinancialDrafts: [{ owedBalanceCents: 1_000 }],
      }),
    ).toBe(false);
  });

  it("never projects balance, owed, debt, or ledger keys", () => {
    const forbiddenKeyArbitrary = fc
      .tuple(fc.constantFrom(...FORBIDDEN_DIGEST_KEYS), fc.string())
      .map(([forbiddenKey, suffix]) => `${forbiddenKey}${suffix}`);

    fc.assert(
      fc.property(
        sourceArbitrary,
        forbiddenKeyArbitrary,
        fc.jsonValue(),
        (source, forbiddenKey, forbiddenValue) => {
          const contaminatedSource = Object.assign({}, source, {
            [forbiddenKey]: forbiddenValue,
          });
          const body = buildDigestBody(contaminatedSource);
          const keys = nestedKeys(body).map((key) => key.toLowerCase());

          expect(isDigestBodyBalanceFree(body)).toBe(true);
          for (const forbiddenFragment of FORBIDDEN_DIGEST_KEYS) {
            expect(keys.every((key) => !key.includes(forbiddenFragment))).toBe(
              true,
            );
          }
        },
      ),
    );
  });
});
