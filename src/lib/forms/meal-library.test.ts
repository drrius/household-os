import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { parseLibraryMealForm, parseMealTemplateForm } from "./meal-library";

const id = "11111111-1111-4111-8111-111111111111";
const form = (values: Record<string, string>) => {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
};

describe("saved meal forms", () => {
  it("trims meal details and rejects unsafe recipe links", () => {
    const values = form({
      libraryId: id,
      name: "  Pasta  ",
      isNew: "yes",
      notes: "  A favourite  ",
    });
    expect(parseLibraryMealForm(values)).toMatchObject({
      name: "Pasta",
      notes: "A favourite",
      isNew: true,
    });
    values.set("recipeUrl", "javascript:alert(1)");
    expect(() => parseLibraryMealForm(values)).toThrow();
  });
  it("keeps textual grocery quantities and units separate", () => {
    const values = form({
      templateId: id,
      libraryId: id,
      name: " Tomatoes ",
      isNew: "yes",
      quantity: "2–3",
      unit: " tins ",
      categoryId: "",
    });
    expect(parseMealTemplateForm(values)).toMatchObject({
      name: "Tomatoes",
      quantity: "2–3",
      unit: "tins",
      categoryId: null,
    });
  });
  it("rejects grocery names exceeding the existing database bound", () => {
    fc.assert(
      fc.property(fc.integer({ min: 121, max: 1000 }), (length) => {
        expect(() =>
          parseMealTemplateForm(
            form({
              templateId: id,
              libraryId: id,
              name: "x".repeat(length),
              isNew: "yes",
            }),
          ),
        ).toThrow();
      }),
    );
  });
});

it("requires the opened version for edits and preserves exact version tokens", () => {
  fc.assert(
    fc.property(
      fc.date({
        min: new Date("2020-01-01"),
        max: new Date("2040-01-01"),
        noInvalidDate: true,
      }),
      (date) => {
        const input = form({
          libraryId: id,
          name: "Pasta",
          isNew: "no",
          version: date.toISOString(),
        });
        expect(parseLibraryMealForm(input).version).toBe(date.toISOString());
        input.delete("version");
        expect(() => parseLibraryMealForm(input)).toThrow();
      },
    ),
  );
});

it("requires exact default-grocery edit versions while new items have no version", () => {
  const input = form({
    templateId: id,
    libraryId: id,
    name: "Pasta",
    isNew: "no",
    version: "2026-09-05T12:00:00.123456+00:00",
  });
  expect(parseMealTemplateForm(input).version).toBe(
    "2026-09-05T12:00:00.123456+00:00",
  );
  input.delete("version");
  expect(() => parseMealTemplateForm(input)).toThrow();
  input.set("isNew", "yes");
  expect(parseMealTemplateForm(input).version).toBeNull();
});
