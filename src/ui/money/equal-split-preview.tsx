import { allocateEqualExpense } from "@/domain/money/allocations";
import { parseChfToCentimesOrNull } from "@/domain/money/chf";
import { asMemberId } from "@/domain/money/values";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";

export function EqualSplitPreview({
  amount,
  payerMemberId,
  members,
}: {
  amount: string;
  payerMemberId: string;
  members: readonly { user_id: string; display_name: string }[];
}) {
  const cents = parseChfToCentimesOrNull(amount);
  const other = members.find((member) => member.user_id !== payerMemberId);
  if (
    cents === null ||
    cents <= 0 ||
    !other ||
    !members.some((member) => member.user_id === payerMemberId)
  )
    return null;
  const allocations = allocateEqualExpense(
    cents,
    asMemberId(payerMemberId),
    asMemberId(other.user_id),
  );
  return (
    <p aria-live="polite" className="text-sm text-muted-foreground">
      {members
        .map(
          (member) =>
            `${member.display_name}: ${formatCentimesAsFrancs(allocations.find((share) => share.memberId === member.user_id)?.allocatedCents ?? 0)}`,
        )
        .join(" · ")}
      {cents % 2 ? ". The payer takes the extra centime." : "."}
    </p>
  );
}
