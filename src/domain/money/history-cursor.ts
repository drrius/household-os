import { z } from "zod";
export const financialHistoryCursor = z.object({
  occurredOn: z.iso.date(),
  createdAt: z.iso.datetime({ offset: true }).max(40),
  id: z.uuid(),
});
export type FinancialHistoryCursor = z.infer<typeof financialHistoryCursor>;
/** Matches the descending date, creation instant, ID ordering without skipping ties. */
export function financialHistoryBefore(input: FinancialHistoryCursor): string {
  const cursor = financialHistoryCursor.parse(input);
  return `occurred_on.lt.${cursor.occurredOn},and(occurred_on.eq.${cursor.occurredOn},created_at.lt.${cursor.createdAt}),and(occurred_on.eq.${cursor.occurredOn},created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`;
}
