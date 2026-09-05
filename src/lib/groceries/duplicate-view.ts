import { normalizeGroceryName } from "@/domain/groceries/duplicates";
import type { GroceriesViewModel } from "@/lib/read-models/groceries";
type ItemRow = {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  state: string;
};
export function buildDuplicateData(items: readonly ItemRow[]): {
  hints: ReadonlyMap<string, string>;
  suggestions: GroceriesViewModel["duplicates"];
} {
  const groups = new Map<string, ItemRow[]>();
  for (const item of items) {
    if (item.state !== "active") continue;
    const key = normalizeGroceryName(item.name);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  const hints = new Map<string, string>();
  const suggestions: GroceriesViewModel["duplicates"] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const first = group[0];
    const amountsDiffer =
      first !== undefined &&
      group.some(
        (item) => item.quantity !== first.quantity || item.unit !== first.unit,
      );
    const hint = amountsDiffer
      ? "Possible duplicate. Quantity or unit differs."
      : "Possible duplicate.";
    for (const [index, left] of group.entries()) {
      hints.set(left.id, hint);
      for (const right of group.slice(index + 1)) {
        suggestions.push({
          leftId: left.id,
          rightId: right.id,
          leftName: left.name,
          rightName: right.name,
        });
      }
    }
  }
  return { hints, suggestions };
}
