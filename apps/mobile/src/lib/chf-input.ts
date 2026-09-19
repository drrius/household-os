import { parseChfToCentimesOrNull } from "../../../../src/domain/money/chf";

export function parseChfToCentimes(input: string): number | null {
  return parseChfToCentimesOrNull(input.replace(/CHF\s?/i, "").trim());
}
