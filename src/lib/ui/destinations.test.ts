import { describe, expect, it } from "vitest";

import {
  GLOBAL_ADD_OPTIONS,
  PRODUCT_DESTINATIONS,
  isFormSurface,
} from "./destinations";

describe("isFormSurface", () => {
  it("treats every create and edit route as a form surface", () => {
    expect(isFormSurface("/groceries/new")).toBe(true);
    expect(isFormSurface("/home/routines/new")).toBe(true);
    expect(isFormSurface("/home/routines/2f1b/edit")).toBe(true);
    expect(isFormSurface("/money/expenses/new")).toBe(true);
    expect(isFormSurface("/money/settlements/new")).toBe(true);
    expect(isFormSurface("/plan/meals/new")).toBe(true);
  });

  it("covers the form surfaces that do not end in new or edit", () => {
    expect(isFormSurface("/home/setup")).toBe(true);
    expect(isFormSurface("/home/occurrences/occurrence-id")).toBe(true);
    expect(isFormSurface("/money/opening-balance")).toBe(true);
    expect(
      isFormSurface("/plan/meals/6b1f0d5c-6f1c-4a2f-9a2c-9d1f0c5b7e33"),
    ).toBe(true);
  });

  it("leaves the primary destinations alone", () => {
    for (const destination of PRODUCT_DESTINATIONS) {
      expect(isFormSurface(destination.href)).toBe(false);
    }
  });

  it("does not match list surfaces that merely contain a form segment", () => {
    expect(isFormSurface("/plan/meals/new/extra")).toBe(false);
    expect(isFormSurface("/home/setup/details")).toBe(false);
    expect(isFormSurface("/money/opening-balances")).toBe(false);
  });

  it("hides the trigger on every surface it can send you to", () => {
    for (const option of GLOBAL_ADD_OPTIONS) {
      expect(isFormSurface(option.href)).toBe(true);
    }
  });
});
