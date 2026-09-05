import type { RecordKind } from "@/domain/home-records/schema";
export const recordTables: Record<RecordKind, string> = {
  inventory: "household_assets",
  contacts: "household_contacts",
  commitments: "household_commitments",
  decisions: "household_decisions",
  documents: "household_documents",
  maintenance: "asset_maintenance",
  options: "decision_options",
  routines: "asset_routines",
};
export function recordPath(kind: RecordKind, id?: string) {
  return `/home/${kind}${id ? `/${id}` : ""}`;
}

export function safeRecordReturn(
  path: string | undefined,
  fallback: string,
): string {
  if (!path) return fallback;
  try {
    const url = new URL(path, "https://household.local");
    return url.origin === "https://household.local" &&
      (/^\/home\/(inventory|contacts|commitments|decisions|documents)(\/[0-9a-f-]{36})?$/.test(
        url.pathname,
      ) ||
        /^\/plan\/projects\/[0-9a-f-]{36}(\/bookings\/[0-9a-f-]{36})?$/.test(
          url.pathname,
        ))
      ? `${url.pathname}${url.search}`
      : fallback;
  } catch {
    return fallback;
  }
}
