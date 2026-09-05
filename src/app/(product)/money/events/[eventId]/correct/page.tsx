import { notFound, redirect } from "next/navigation";
import { loadMoneyEvent } from "@/lib/read-models/money-event";
import { loadMoneyFormOptions } from "@/lib/forms/options";
import { FormPage } from "@/ui/forms/form-page";
import { CorrectionForm } from "@/ui/money/correction-form";

export default async function CorrectMoneyEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const [detail, options] = await Promise.all([
    loadMoneyEvent(eventId),
    loadMoneyFormOptions(),
  ]);
  if (!detail) notFound();
  if (
    (detail.isReversed && !detail.canCorrectOpening) ||
    detail.event.type === "reversal" ||
    detail.activeRefundCount > 0
  )
    redirect(`/money/events/${eventId}`);
  return (
    <FormPage
      title="Correct financial event"
      backHref={`/money/events/${eventId}`}
      description={`Correct “${detail.event.description}”. Saving a correction reverses the original and records a replacement together. Your history stays intact.`}
    >
      <CorrectionForm detail={detail} categories={options.categories} />
    </FormPage>
  );
}
