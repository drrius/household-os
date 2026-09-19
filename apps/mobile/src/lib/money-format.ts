import { formatCentimesField } from "../../../../src/domain/money/chf";

export function formatCentimes(cents: number): string {
  return `CHF ${formatCentimesField(Math.abs(cents))}`;
}
