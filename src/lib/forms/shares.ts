import { validateExactAllocations } from "@/domain/money/allocations";
import { parseChfToCentimesOrNull } from "@/domain/money/chf";
import { asMemberId } from "@/domain/money/values";

export type ShareReconciliation = {
  amountCents: number;
  differenceCents: number;
  filledShareCount: number;
  shareCount: number;
  sharesCents: number;
};

export function reconcileShares(
  amount: string,
  shares: readonly string[],
): ShareReconciliation | null {
  const amountCents = parseChfToCentimesOrNull(amount);
  if (amountCents === null) {
    return null;
  }
  let sharesCents = 0;
  let filledShareCount = 0;
  for (const share of shares) {
    if (share.trim().length === 0) continue;
    const shareCents = parseChfToCentimesOrNull(share);
    if (shareCents === null) {
      return null;
    }
    sharesCents += shareCents;
    filledShareCount += 1;
  }
  if (!Number.isSafeInteger(sharesCents)) {
    return null;
  }
  return {
    amountCents,
    differenceCents: sharesCents - amountCents,
    filledShareCount,
    shareCount: shares.length,
    sharesCents,
  };
}

export function exactSharesBalance(input: {
  amountCents: number;
  memberIds: readonly [string, string];
  payerMemberId: string;
  sharesCents: readonly [number, number];
}): boolean {
  return validateExactAllocations(
    input.amountCents,
    asMemberId(input.payerMemberId),
    asMemberId(
      input.memberIds.find((memberId) => memberId !== input.payerMemberId) ??
        input.memberIds[1],
    ),
    [
      {
        memberId: asMemberId(input.memberIds[0]),
        allocatedCents: input.sharesCents[0],
      },
      {
        memberId: asMemberId(input.memberIds[1]),
        allocatedCents: input.sharesCents[1],
      },
    ],
  ).ok;
}
