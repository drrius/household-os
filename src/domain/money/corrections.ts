import { validateExactAllocations } from "./allocations";
import { projectFinancialEvent } from "./projection";
import type {
  FinancialEvent,
  LedgerEntry,
  PlannedReplacement,
  PlannedReversal,
  ReplacementPlanInput,
} from "./types";
import { asCentimeAmount } from "./values";

export type CorrectionPlanError = {
  code: "target_ledger_mismatch" | "invalid_replacement";
  message: string;
};

export type CorrectionPlanResult =
  | {
      ok: true;
      reversal: PlannedReversal;
      replacement?: PlannedReplacement;
    }
  | { ok: false; error: CorrectionPlanError };

function sameLedger(
  actual: readonly LedgerEntry[],
  expected: readonly LedgerEntry[],
): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  const unmatched = [...actual];
  for (const entry of expected) {
    const index = unmatched.findIndex(
      (candidate) =>
        candidate.financialEventId === entry.financialEventId &&
        candidate.memberId === entry.memberId &&
        candidate.receivableDeltaCents === entry.receivableDeltaCents,
    );
    if (index === -1) {
      return false;
    }
    unmatched.splice(index, 1);
  }
  return true;
}

function planReplacement(
  input: ReplacementPlanInput,
): PlannedReplacement | CorrectionPlanError {
  const validated = validateExactAllocations(
    input.amountCents,
    input.payerMemberId,
    input.otherMemberId,
    input.allocations,
  );
  if (!validated.ok) {
    return {
      code: "invalid_replacement",
      message: validated.error.message,
    };
  }
  return {
    type: "replacement",
    amountCents: asCentimeAmount(input.amountCents),
    payerMemberId: input.payerMemberId,
    otherMemberId: input.otherMemberId,
    allocations: validated.allocations,
  };
}

export function planCorrection(input: {
  targetEvent: FinancialEvent;
  targetLedger: readonly LedgerEntry[];
  replacement?: ReplacementPlanInput;
}): CorrectionPlanResult {
  const expectedLedger = projectFinancialEvent(input.targetEvent);
  if (!sameLedger(input.targetLedger, expectedLedger)) {
    return {
      ok: false,
      error: {
        code: "target_ledger_mismatch",
        message: "Target ledger does not match the target financial event",
      },
    };
  }
  const reversal: PlannedReversal = {
    type: "reversal",
    amountCents: input.targetEvent.amountCents,
    relatedEventId: input.targetEvent.id,
    relatedLedgerEntries: [...input.targetLedger],
  };
  if (input.replacement === undefined) {
    return { ok: true, reversal };
  }
  const replacement = planReplacement(input.replacement);
  if ("code" in replacement) {
    return { ok: false, error: replacement };
  }
  return { ok: true, reversal, replacement };
}
