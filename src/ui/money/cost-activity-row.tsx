import Link from "next/link";
import { costTargetHref, type CostTarget } from "@/domain/money/cost-target";
import type { CostContextPage } from "@/lib/connected/cost-context";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
const eventLabels = {
  expense: "Payment",
  replacement: "Corrected payment",
  refund: "Refund",
  reversal: "Reversal",
} as const;
export function CostActivityRow({
  event,
  target,
  members,
}: {
  event: CostContextPage["events"][number];
  target: CostTarget;
  members: readonly { user_id: string; display_name: string }[];
}) {
  return (
    <li className="py-4">
      <details>
        <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <div className="grid min-w-0 gap-1">
            <p className="break-words font-medium">{event.description}</p>
            <p className="text-base text-muted-foreground sm:text-sm">
              {eventLabels[event.type]} · {event.occurred_on}
            </p>
            <p className="text-base text-muted-foreground underline sm:text-sm">
              Payment details
            </p>
          </div>
          <p className="shrink-0 font-medium tabular-nums">
            {formatCentimesAsFrancs(BigInt(event.signed_cents))}
          </p>
        </summary>
        <div className="grid gap-2 pt-3 text-base text-muted-foreground sm:text-sm">
          <p>
            {event.type === "refund"
              ? "Refund received by"
              : event.type === "reversal"
                ? "Reverses a payment by"
                : "Paid by"}{" "}
            {members.find((member) => member.user_id === event.payer_member_id)
              ?.display_name ?? "a household member"}
            .
          </p>
          {event.inherited && (
            <p>This follows the original payment’s household context.</p>
          )}
          {event.booking_id && !target.bookingId && (
            <Link
              className="min-h-11 content-center underline"
              href={costTargetHref({
                ...target,
                bookingId: event.booking_id,
              })}
            >
              View booking costs
            </Link>
          )}
          <p>
            Payment corrections and refunds remain in your financial history.
          </p>
        </div>
      </details>
    </li>
  );
}
