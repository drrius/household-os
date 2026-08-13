/**
 * CHF text parsing shared by the browser and the server, so a split the browser
 * calls balanced is the same split the ledger accepts. Amounts stay integer
 * centimes and the intermediate arithmetic is BigInt, never a float.
 */

const chfAmountPattern = /^(\d{1,13})(?:\.(\d{1,2}))?$/;

function normalizeChf(value: string): string {
  return value.trim().replace(",", ".");
}

/** Null rather than a throw: a half-typed amount is not an error yet. */
export function parseChfToCentimesOrNull(value: string): number | null {
  const match = chfAmountPattern.exec(normalizeChf(value));
  if (match === null) {
    return null;
  }
  const francs = BigInt(match[1] ?? "0");
  const decimal = (match[2] ?? "").padEnd(2, "0");
  const centimes = francs * 100n + BigInt(decimal || "0");
  if (centimes > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  return Number(centimes);
}

export function parseChfToCentimes(value: string): number {
  const normalized = normalizeChf(value);
  if (!chfAmountPattern.test(normalized)) {
    throw new Error("Enter a CHF amount with at most two decimal places.");
  }
  const centimes = parseChfToCentimesOrNull(normalized);
  if (centimes === null) {
    throw new Error("The CHF amount is too large.");
  }
  return centimes;
}

export function formatCentimesField(centimes: number): string {
  const absolute = Math.abs(centimes);
  return `${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

export type ShareReconciliation = {
  amountCents: number;
  /** Shares minus amount: negative is short of the total, positive is over it. */
  differenceCents: number;
  filledShareCount: number;
  shareCount: number;
  sharesCents: number;
};

/**
 * Live reading of an exact split. Blank shares count as nothing so the running
 * total stays useful while one is still being typed; null when the amount or a
 * filled share cannot be read as CHF at all.
 */
export function reconcileShares(
  amount: string,
  shares: readonly string[],
): ShareReconciliation | null {
  const amountCents = parseChfToCentimesOrNull(amount);
  if (amountCents === null) {
    return null;
  }
  let sharesCents = 0;
  let filledShareCount = 0;
  for (const share of shares) {
    if (share.trim().length === 0) continue;
    const shareCents = parseChfToCentimesOrNull(share);
    if (shareCents === null) {
      return null;
    }
    sharesCents += shareCents;
    filledShareCount += 1;
  }
  if (!Number.isSafeInteger(sharesCents)) {
    return null;
  }
  return {
    amountCents,
    differenceCents: sharesCents - amountCents,
    filledShareCount,
    shareCount: shares.length,
    sharesCents,
  };
}

/** The rule `validateExactAllocations` enforces on the server, read live. */
export function sharesBalance(
  reconciliation: ShareReconciliation | null,
): boolean {
  return (
    reconciliation !== null &&
    reconciliation.filledShareCount === reconciliation.shareCount &&
    reconciliation.differenceCents === 0
  );
}
