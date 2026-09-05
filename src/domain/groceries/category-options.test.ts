import { describe, expect, it } from "vitest";
import {
  groceryCategoryOptions,
  groceryCategorySelection,
} from "./category-options";
const categories = [
  { id: "fallback", name: "Unsorted", is_fallback: true },
  { id: "produce", name: "Produce", is_fallback: false },
  { id: "other", name: "Other", is_fallback: false },
];
describe("grocery category choice identity", () => {
  it("uses the renamed fallback exactly once while preserving an ordinary category named Other", () => {
    expect(groceryCategoryOptions(categories)).toEqual([
      { label: "Unsorted", value: "" },
      { label: "Produce", value: "produce" },
      { label: "Other", value: "other" },
    ]);
  });
  it("shows the same choice for null, explicit fallback and archived categories", () => {
    for (const id of [null, "fallback", "archived"])
      expect(groceryCategorySelection(categories, id)).toBe("");
    expect(groceryCategorySelection(categories, "produce")).toBe("produce");
    expect(groceryCategoryOptions([])).toEqual([{ label: "Other", value: "" }]);
  });
});
