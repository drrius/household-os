import { asCentimeAmount } from "./values";

export function settlementAmount(input: {
  outstandingCents: number;
  mode: "full" | "partial";
  requestedCents: number | null;
}): number {
  const outstanding = asCentimeAmount(input.outstandingCents);
  if (outstanding === 0)
    throw new Error("The household is already settled up.");
  if (input.mode === "full") return outstanding;
  if (
    input.requestedCents === null ||
    !Number.isSafeInteger(input.requestedCents) ||
    input.requestedCents <= 0 ||
    input.requestedCents > outstanding
  ) {
    throw new Error("A partial settlement must be within the current balance.");
  }
  return input.requestedCents;
}
