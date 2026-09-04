import { normalizeGroceryName } from "./duplicates";
export type GroceryCategoryOrder = {
  id: string;
  name: string;
  sort_order: number;
};
export type OrderedGrocery = {
  id: string;
  category_id: string | null;
  sort_order: number;
};
export type GroceryCategoryGroup<T> = {
  id: string;
  name: string;
  sortOrder: number;
  items: T[];
};

export function groupGroceries<T extends OrderedGrocery>(
  categories: readonly GroceryCategoryOrder[],
  items: readonly T[],
): GroceryCategoryGroup<T>[] {
  const orderedCategories = [...categories].sort(
    (left, right) =>
      left.sort_order - right.sort_order || left.id.localeCompare(right.id),
  );
  const buckets = new Map<string, GroceryCategoryGroup<T>>(
    orderedCategories.map((category) => [
      category.id,
      {
        id: category.id,
        name: category.name,
        sortOrder: category.sort_order,
        items: [],
      },
    ]),
  );
  const other = orderedCategories.find(
    (category) => normalizeGroceryName(category.name) === "other",
  );
  const fallback: GroceryCategoryGroup<T> = {
    id: other?.id ?? "uncategorized",
    name: other?.name ?? "Other",
    sortOrder: other?.sort_order ?? Number.MAX_SAFE_INTEGER,
    items: [],
  };

  for (const item of items) {
    const category =
      item.category_id === null ? undefined : buckets.get(item.category_id);
    const bucket = category ?? buckets.get(fallback.id) ?? fallback;
    if (!buckets.has(bucket.id)) {
      buckets.set(bucket.id, bucket);
    }
    bucket.items.push(item);
  }

  return [...buckets.values()]
    .filter((bucket) => bucket.items.length > 0)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
    )
    .map((bucket) => ({
      ...bucket,
      items: [...bucket.items].sort(
        (left, right) =>
          left.sort_order - right.sort_order || left.id.localeCompare(right.id),
      ),
    }));
}

export const MAX_GROCERY_POSITION = 2147483647;

export function nextGroceryPosition(previous: number | undefined): number {
  if (previous === undefined) return 0;
  if (
    !Number.isInteger(previous) ||
    previous < 0 ||
    previous > MAX_GROCERY_POSITION
  )
    throw new Error("Invalid grocery position");
  return Math.min(MAX_GROCERY_POSITION, previous + 10);
}
