export function isExpenseDraftReady(input: {
  amountCents: number | null;
  payerMemberId: string | null;
  proposedAllocations: unknown;
}): boolean {
  return (
    input.amountCents !== null &&
    input.payerMemberId !== null &&
    Array.isArray(input.proposedAllocations) &&
    input.proposedAllocations.length === 2
  );
}
