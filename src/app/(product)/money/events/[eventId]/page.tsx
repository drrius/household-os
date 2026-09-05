import { notFound } from "next/navigation";
import { loadMoneyEvent } from "@/lib/read-models/money-event";
import { EventDetail } from "@/ui/money/event-detail";

export default async function MoneyEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const detail = await loadMoneyEvent((await params).eventId);
  if (!detail) notFound();
  return <EventDetail detail={detail} />;
}
