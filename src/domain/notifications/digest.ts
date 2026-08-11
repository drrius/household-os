import type { DigestBody, DigestSourceSnapshot } from "./types";

export const FORBIDDEN_DIGEST_KEYS = [
  "balance",
  "owed",
  "owedBalance",
  "owedBalanceCents",
  "debt",
  "ledger",
  "netBalance",
  "amountOwed",
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

export function digestBodyContainsForbiddenKey(
  body: DigestBody,
  forbiddenKeys: readonly string[] = FORBIDDEN_DIGEST_KEYS,
): boolean {
  const serialized = JSON.stringify(body);
  return forbiddenKeys.some((key) =>
    serialized.includes(`"${key}"`) ||
    Object.prototype.hasOwnProperty.call(body, key),
  );
}
