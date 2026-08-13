/**
 * CHF text parsing shared by the browser and the server, so a split the browser
 * calls balanced is the same split the ledger accepts. Amounts stay integer
 * centimes and the intermediate arithmetic is BigInt, never a float.
 */

export const chfAmountMessage =
  "Enter a CHF amount with at most two decimal places.";

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
    throw new Error(chfAmountMessage);
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
