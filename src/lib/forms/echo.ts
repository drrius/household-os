const regeneratedKeys = new Set(["idempotencyKey"]);

/**
 * Copies every submitted string field except keys that must be minted again
 * on the next render. Repeated names (`weekdays`) are joined so a rejected
 * submit can restore `getAll` values.
 */
export function echoValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of new Set(formData.keys())) {
    if (regeneratedKeys.has(name)) continue;
    const parts = formData
      .getAll(name)
      .filter((value): value is string => typeof value === "string");
    if (parts.length === 0) continue;
    values[name] = parts.join("\u001f");
  }
  return values;
}

export function echoedList(value: string | undefined): readonly string[] {
  if (value === undefined || value.length === 0) return [];
  return value.split("\u001f");
}
