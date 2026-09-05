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
            form({ templateId: id, libraryId: id, name: "x".repeat(length) }),
          ),
        ).toThrow();
      }),
    );
  });
});
