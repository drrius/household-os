export type GroceryCategoryOption = {
  id: string;
  name: string;
  is_fallback: boolean;
};

export function groceryCategoryOptions(
  categories: readonly GroceryCategoryOption[],
) {
  return [
    {
      label: groceryFallbackLabel(categories),
      value: "",
    },
    ...categories
      .filter((category) => !category.is_fallback)
      .map((category) => ({ label: category.name, value: category.id })),
  ];
}

export function groceryCategorySelection(
  categories: readonly GroceryCategoryOption[],
  id: string | null,
) {
  return id !== null &&
    categories.some((category) => category.id === id && !category.is_fallback)
    ? id
    : "";
}

export function groceryFallbackLabel(
  categories: readonly GroceryCategoryOption[],
): string {
  const name =
    categories.find((category) => category.is_fallback)?.name ?? "Other";
  const names = new Set(
    categories
      .filter((category) => !category.is_fallback)
      .map((category) => category.name.toLowerCase()),
  );
  if (!names.has(name.toLowerCase())) return name;
  let label = `${name} (unassigned)`;
  let suffix = 2;
  while (names.has(label.toLowerCase()))
    label = `${name} (unassigned ${suffix++})`;
  return label;
}
