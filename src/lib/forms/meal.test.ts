import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { errorField } from "./field-error";
import {
  parseMealForm,
  parsePlaceFromLibraryForm,
  parseRemoveMealForm,
  parseUpdateMealForm,
} from "./meal";

const entryId = "11111111-1111-4111-8111-111111111111";
const libraryId = "33333333-3333-4333-8333-333333333333";
const idempotencyKey = "44444444-4444-4444-8444-444444444444";

function mealForm(recipeUrl: string): FormData {
  const form = new FormData();
  form.set("title", "Pasta");
  form.set("date", "2026-08-14");
  form.set("slot", "dinner");
  form.set("recipeUrl", recipeUrl);
  form.set("idempotencyKey", idempotencyKey);
  return form;
}

function rejection(recipeUrl: string): unknown {
  try {
    parseMealForm(mealForm(recipeUrl));
  } catch (error) {
    return error;
  }
  return null;
}

describe("meal form recipe links", () => {
  it("names the failing control so the error renders under it", () => {
    const failure = rejection("ftp://example.invalid/pasta");
    expect(errorField(failure)).toBe("recipeUrl");
    expect(failure).toMatchObject({
      message: "Recipe links must start with http:// or https://.",
    });
  });

  it("rejects unparseable links as the same field error", () => {
    expect(errorField(rejection("not a url"))).toBe("recipeUrl");
  });

  it("treats a blank recipe link as absent", () => {
    expect(parseMealForm(mealForm("   "))).toMatchObject({ recipeUrl: null });
  });

  it("accepts only http and https schemes", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("http", "https", "ftp", "javascript", "file", "data"),
        (scheme) => {
          const failure = rejection(`${scheme}://example.invalid/pasta`);
          if (scheme === "http" || scheme === "https") {
            expect(failure).toBeNull();
            return;
          }
          expect(errorField(failure)).toBe("recipeUrl");
        },
      ),
    );
  });
});

describe("meal form parsing", () => {
  it("parses meal placement and optional library save", () => {
    const form = new FormData();
    form.set("title", "Pasta");
    form.set("date", "2026-08-14");
    form.set("slot", "dinner");
    form.set("recipeUrl", "https://example.test/pasta");
    form.set("saveToLibrary", "on");
    form.set("idempotencyKey", idempotencyKey);
    expect(parseMealForm(form)).toMatchObject({
      title: "Pasta",
      date: "2026-08-14",
      slot: "dinner",
      saveToLibrary: true,
    });
  });

  it("parses place-from-library without freeform title fields", () => {
    const form = new FormData();
    form.set("libraryId", libraryId);
    form.set("date", "2026-08-14");
    form.set("slot", "lunch");
    form.set("notes", "  use basil  ");
    form.set("idempotencyKey", idempotencyKey);
    expect(parsePlaceFromLibraryForm(form)).toEqual({
      libraryId,
      date: "2026-08-14",
      slot: "lunch",
      notes: "use basil",
      idempotencyKey,
    });
  });

  it("parses remove meal entry fields", () => {
    const form = new FormData();
    form.set("entryId", entryId);
    form.set("date", "2026-08-14");
    form.set("idempotencyKey", idempotencyKey);
    expect(parseRemoveMealForm(form)).toEqual({
      entryId,
      date: "2026-08-14",
      idempotencyKey,
    });
  });

  it("parses update meal entry fields", () => {
    const form = new FormData();
    form.set("entryId", entryId);
    form.set("title", "  Chicken & Rice  ");
    form.set("date", "2026-08-13");
    form.set("slot", "breakfast");
    form.set("recipeUrl", "https://example.invalid/chicken");
    form.set("notes", "  leftovers tomorrow  ");
    form.set("idempotencyKey", idempotencyKey);
    expect(parseUpdateMealForm(form)).toEqual({
      entryId,
      title: "Chicken & Rice",
      date: "2026-08-13",
      slot: "breakfast",
      recipeUrl: "https://example.invalid/chicken",
      notes: "leftovers tomorrow",
      idempotencyKey,
    });
  });
});
