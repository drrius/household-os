export const echoListSeparator = "\u001f";

const keysMintedOnNextRender = new Set(["idempotencyKey"]);

export function echoValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of new Set(formData.keys())) {
    if (keysMintedOnNextRender.has(name)) continue;
    const parts = formData
      .getAll(name)
      .filter((value): value is string => typeof value === "string");
    if (parts.length === 0) continue;
    values[name] = parts.join(echoListSeparator);
  }
  return values;
}

export function echoedList(value: string | undefined): readonly string[] {
  if (value === undefined || value.length === 0) return [];
  return value.split(echoListSeparator);
}
