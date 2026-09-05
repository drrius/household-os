import type { FinancialEventType } from "@/domain/money/types";

export const moneyEventLabels = {
  opening_balance: "Starting balance",
  expense: "Expense",
  refund: "Refund",
  settlement: "Settlement",
  reversal: "Reversal",
  replacement: "Corrected expense",
} satisfies Record<FinancialEventType, string>;
