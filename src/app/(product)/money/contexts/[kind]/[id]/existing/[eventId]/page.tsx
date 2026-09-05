import { notFound } from "next/navigation";
import { z } from "zod";
import { costTargetHref } from "@/domain/money/cost-target";
import { loadAssociationExpense } from "@/lib/connected/cost-associations";
import { loadCostRecord } from "@/lib/connected/cost-records";
import { parseCostRoute } from "@/lib/connected/cost-route";
import { AssociationConfirmation } from "@/ui/money/association-confirmation.client";
import { FormPage } from "@/ui/forms/form-page";
import { associateExpenseAction } from "../../../../association-actions";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string; eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const args = await Promise.all([params, searchParams]);
  let route, eventId;
  try {
    route = parseCostRoute(...args);
    eventId = z.uuid().parse(args[0].eventId);
  } catch {
    notFound();
  }
  const [record, item] = await Promise.all([
    loadCostRecord(route.target),
    loadAssociationExpense(eventId),
  ]);
  if (
    !record ||
    !item ||
    record.record.archived_at ||
    record.booking?.archived_at
  )
    notFound();
  const title = record.booking
    ? `${record.record.title} · ${record.booking.title}`
    : record.record.title;
  const current = item.current
    ? [item.current.record.title, item.current.booking?.title]
        .filter(Boolean)
        .join(" · ")
    : null;
  return (
    <FormPage
      title="Review expense association"
      description="Use the payment already recorded in Money."
      backHref={costTargetHref(route.target)}
    >
      <AssociationConfirmation
        key={`${eventId}:${route.target.kind}:${route.target.id}:${route.target.bookingId ?? ""}`}
        action={associateExpenseAction.bind(null, eventId, route.target)}
        expense={item.expense}
        currentTitle={current}
        destinationTitle={title}
        revision={item.association?.revision ?? null}
        requestId={crypto.randomUUID()}
      />
    </FormPage>
  );
}
