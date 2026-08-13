export type FrancDisplay = string & {
  readonly __brand: "FrancDisplay";
};

export function formatCentimesAsFrancs(centimes: number): FrancDisplay {
  if (!Number.isSafeInteger(centimes)) {
    throw new RangeError("Centimes must be a safe integer");
  }

  const absoluteCentimes = Math.abs(centimes);
  const francs = Math.trunc(absoluteCentimes / 100);
  const remainder = String(absoluteCentimes % 100).padStart(2, "0");
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
