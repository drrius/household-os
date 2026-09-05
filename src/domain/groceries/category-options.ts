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
      label:
        categories.find((category) => category.is_fallback)?.name ?? "Other",
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
