import type { RecordKind } from "./schema";

export const recordCreationConflict =
  "This record already exists with different details or is no longer active. Your changes were not saved. Return to the record list or parent record, then open the existing entry before editing it.";

/** Submitted values are already normalized. Stored centimes must not be parsed as CHF. */
export function matchesRecordCreation(
  kind: RecordKind,
  values: Readonly<Record<string, unknown>>,
  existing: unknown,
): boolean {
  if (!isRecord(existing)) return false;
  if (existing.archived_at !== null) return false;
  if (kind === "options" && existing.chosen !== false) return false;
  if (kind === "decisions" && existing.status !== "considering") return false;
  return Object.entries(values).every(
    ([key, value]) => existing[key] === value,
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
