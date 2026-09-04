export type RefundShare = { memberId: string; allocatedCents: number };

export function remainingRefundShares(
  original: readonly RefundShare[],
  refunded: readonly RefundShare[],
): RefundShare[] {
  return original.map((share) => {
    if (!Number.isSafeInteger(share.allocatedCents) || share.allocatedCents < 0)
      throw new Error("Invalid original allocation.");
    const used = refunded
      .filter((row) => row.memberId === share.memberId)
      .reduce((sum, row) => {
        if (!Number.isSafeInteger(row.allocatedCents) || row.allocatedCents < 0)
          throw new Error("Invalid refund allocation.");
        return sum + BigInt(row.allocatedCents);
      }, 0n);
    const remaining = BigInt(share.allocatedCents) - used;
    if (remaining < 0n)
      throw new Error("Refunds exceed the original allocation.");
    return { memberId: share.memberId, allocatedCents: Number(remaining) };
  });
}

export function allocateProportionalRefund(
  amount: number,
  remaining: readonly RefundShare[],
): RefundShare[] {
  const [first, second] = remaining;
  if (
    remaining.length !== 2 ||
    !first ||
    !second ||
    first.memberId === second.memberId
  )
    throw new Error("A refund needs both household members.");
  for (const value of [amount, first.allocatedCents, second.allocatedCents])
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error("Refunds use non-negative integer centimes.");
  const total = BigInt(first.allocatedCents) + BigInt(second.allocatedCents);
  if (amount <= 0 || BigInt(amount) > total)
    throw new Error("The refund exceeds what remains of this expense.");
  const firstAmount = Number(
    (BigInt(amount) * BigInt(first.allocatedCents)) / total,
  );
  return [
    { memberId: first.memberId, allocatedCents: firstAmount },
    { memberId: second.memberId, allocatedCents: amount - firstAmount },
  ];
}
