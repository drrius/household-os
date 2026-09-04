import { notFound, redirect } from "next/navigation";
import { loadMoneyEvent } from "@/lib/read-models/money-event";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { FormPage } from "@/ui/forms/form-page";
import { RefundForm } from "@/ui/money/refund-form";

export default async function RefundMoneyEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const detail = await loadMoneyEvent(eventId);
  if (!detail) notFound();
  if (
    detail.isReversed ||
    !["expense", "replacement"].includes(detail.event.type) ||
    !detail.remaining.some((share) => share.allocatedCents > 0)
  )
    redirect(`/money/events/${eventId}`);
  const payer = detail.members.find(
    (member) => member.user_id === detail.event.payer_member_id,
  )?.display_name;
  return (
    <FormPage
      title="Record refund"
      backHref={`/money/events/${eventId}`}
      description={`For “${detail.event.description}”. Record money already refunded to ${payer ?? "the original payer"}. Each person's refund is limited to their remaining share.`}
    >
      <RefundForm detail={detail} occurredOn={zurichCivilDate()} />
    </FormPage>
  );
}
