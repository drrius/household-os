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
