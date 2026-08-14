import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { errorField } from "./field-error";
import { parseMealForm } from "./meal";

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
