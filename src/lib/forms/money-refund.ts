import { z } from "zod";
import {
  allocateProportionalRefund,
  type RefundShare,
} from "@/domain/money/refund-remaining";
import { parseChfField } from "@/lib/forms/money";
import { FormFieldError } from "@/lib/forms/field-error";

export function parseRefundForm(
  form: FormData,
  remaining: readonly RefundShare[],
) {
  const amountCents = parseChfField(form, "amount");
  allocateProportionalRefund(amountCents, remaining);
  z.enum(["original", "exact"]).parse(form.get("refundSplit"));
  const allocations = remaining.map((share) => ({
    memberId: share.memberId,
    allocatedCents: parseChfField(form, `allocation:${share.memberId}`),
  }));
  if (
    allocations.reduce((sum, row) => sum + BigInt(row.allocatedCents), 0n) !==
    BigInt(amountCents)
  )
    throw new FormFieldError(
      "amount",
      "Both refund shares must add up to the refund amount.",
    );
  for (const allocation of allocations) {
    if (
      allocation.allocatedCents >
      (remaining.find((row) => row.memberId === allocation.memberId)
        ?.allocatedCents ?? 0)
    )
      throw new FormFieldError(
        `allocation:${allocation.memberId}`,
        "This share exceeds what remains of the original expense.",
      );
  }
  return {
    relatedEventId: z.string().uuid().parse(form.get("eventId")),
    amountCents,
    allocations,
    occurredOn: z.iso.date().parse(form.get("occurredOn")),
    idempotencyKey: z.string().uuid().parse(form.get("idempotencyKey")),
    description: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .parse(form.get("description")),
    note: z
      .string()
      .trim()
      .max(4000)
      .nullable()
      .parse(form.get("note") || null),
  };
}
