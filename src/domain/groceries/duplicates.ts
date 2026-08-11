import type { GroceryItemId } from "./types";

export type DuplicateCandidate = {
  id: GroceryItemId;
  name: string;
  quantity: string | null;
  unit: string | null;
};

export type DuplicateSuggestion = {
  existingItemId: GroceryItemId;
  candidateName: string;
  existingName: string;
  quantityOrUnitDiffer: boolean;
};

export type ExplicitMergeResolution = {
  name: string;
  quantity: string | null;
  unit: string | null;
  categoryId: string | null;
  note: string | null;
  sortOrder: number;
};

export type ExplicitMergePlan = {
  keepItemId: GroceryItemId;
  removeItemId: GroceryItemId;
  resolution: ExplicitMergeResolution;
};

export function normalizeGroceryName(name: string): string {
  return name
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
}

export function suggestGroceryDuplicates(
  candidate: { name: string; quantity: string | null; unit: string | null },
  existing: readonly DuplicateCandidate[],
): DuplicateSuggestion[] {
  const normalized = normalizeGroceryName(candidate.name);
  if (normalized.length === 0) {
    return [];
  }

  const suggestions: DuplicateSuggestion[] = [];
  for (const item of existing) {
    if (normalizeGroceryName(item.name) !== normalized) {
      continue;
    }
    suggestions.push({
      existingItemId: item.id,
      candidateName: candidate.name,
      existingName: item.name,
      quantityOrUnitDiffer:
        (candidate.quantity ?? null) !== (item.quantity ?? null) ||
        (candidate.unit ?? null) !== (item.unit ?? null),
    });
  }
  return suggestions;
}

export function planExplicitDuplicateMerge(input: {
  keepItemId: GroceryItemId;
  removeItemId: GroceryItemId;
  resolution: ExplicitMergeResolution;
}): ExplicitMergePlan {
  if (input.keepItemId === input.removeItemId) {
    throw new Error("Merge requires two distinct grocery items");
  }

  return {
    keepItemId: input.keepItemId,
    removeItemId: input.removeItemId,
    resolution: {
      name: input.resolution.name.trim(),
      quantity: input.resolution.quantity,
      unit: input.resolution.unit,
      categoryId: input.resolution.categoryId,
      note: input.resolution.note,
      sortOrder: input.resolution.sortOrder,
    },
  };
}
