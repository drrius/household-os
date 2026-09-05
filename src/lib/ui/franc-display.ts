export type FrancDisplay = string & {
  readonly __brand: "FrancDisplay";
};

export function formatCentimesAsFrancs(
  centimes: number | bigint,
): FrancDisplay {
  if (typeof centimes === "number" && !Number.isSafeInteger(centimes)) {
    throw new RangeError("Centimes must be a safe integer");
  }

  const exact = BigInt(centimes);
  const absoluteCentimes = exact < 0n ? -exact : exact;
  const francs = absoluteCentimes / 100n;
  const remainder = String(absoluteCentimes % 100n).padStart(2, "0");
  const prefix = centimes < 0 ? "-CHF " : "CHF ";

  return `${prefix}${francs}.${remainder}` as FrancDisplay;
}

/**
 * Formats a signed centime delta so the direction is visible: `+CHF 9.25`,
 * `-CHF 0.50`, `CHF 0.00`. Use it for balance movements; keep
 * `formatCentimesAsFrancs` for absolute amounts such as the balance hero.
 */
export function formatSignedCentimesAsFrancs(centimes: number): FrancDisplay {
  const formatted = formatCentimesAsFrancs(centimes);

  return (centimes > 0 ? `+${formatted}` : formatted) as FrancDisplay;
}
