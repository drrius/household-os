import type { DigestBody, DigestSourceSnapshot } from "./types";

export const FORBIDDEN_DIGEST_KEYS = [
  "balance",
  "owed",
  "debt",
  "ledger",
] as const;

export function buildDigestBody(source: DigestSourceSnapshot): DigestBody {
  return {
    overdueRoutines: source.overdueRoutines,
    dueTodayRoutines: source.dueTodayRoutines,
    todaysMeals: source.todaysMeals,
    preparationTasks: source.preparationTasks,
    groceriesActive: source.groceriesActive,
    pendingFinancialDrafts: source.pendingFinancialDrafts,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isDigestBodyBalanceFree(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.every(isDigestBodyBalanceFree);
  }

  if (!isRecord(value)) {
    return true;
  }

  return Object.entries(value).every(
    ([key, nestedValue]) =>
      FORBIDDEN_DIGEST_KEYS.every(
        (forbiddenKey) => !key.toLowerCase().includes(forbiddenKey),
      ) && isDigestBodyBalanceFree(nestedValue),
  );
}
