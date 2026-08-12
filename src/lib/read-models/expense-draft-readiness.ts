import { z } from "zod";

import { validateExactAllocations } from "@/domain/money/allocations";
import { asMemberId } from "@/domain/money/values";

const proposedAllocationSchema = z.object({
  memberId: z.string().min(1),
  allocatedCents: z.number().int(),
});

export function isExpenseDraftReady(input: {
  amountCents: number | null;
  payerMemberId: string | null;
  memberIds: readonly string[];
  proposedAllocations: unknown;
}): boolean {
  if (input.amountCents === null || input.payerMemberId === null) {
    return false;
  }

  const otherMemberId = input.memberIds.find(
    (memberId) => memberId !== input.payerMemberId,
  );
  if (otherMemberId === undefined || input.memberIds.length !== 2) {
    return false;
  }

  const parsed = z
    .array(proposedAllocationSchema)
    .safeParse(input.proposedAllocations);
  if (!parsed.success) {
    return false;
  }

  return validateExactAllocations(
    input.amountCents,
    asMemberId(input.payerMemberId),
    asMemberId(otherMemberId),
    parsed.data.map((allocation) => ({
      memberId: asMemberId(allocation.memberId),
      allocatedCents: allocation.allocatedCents,
    })),
  ).ok;
}
