import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MoneyEventDetail } from "@/lib/read-models/money-event";
import {
  formatCentimesAsFrancs,
  formatSignedCentimesAsFrancs,
} from "@/lib/ui/franc-display";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";
import { PageSection } from "@/ui/layout/page-section";

function EventActions({ detail }: { detail: MoneyEventDetail }) {
  const { event, isReversed, activeRefundCount, remaining } = detail;
  const expense = event.type === "expense" || event.type === "replacement";
  if ((isReversed && !detail.canCorrectOpening) || event.type === "reversal")
    return (
      <p className="text-sm text-muted-foreground">
        This event stays in your history. Its reversal cancels its effect on
        your balance.
      </p>
    );
  return (
    <div className="flex flex-wrap gap-2">
      {expense &&
      !detail.hasExcessRefund &&
      remaining.some((share) => share.allocatedCents > 0) ? (
        <Link
          className={buttonVariants({ variant: "outline" })}
          href={`/money/events/${event.id}/refund`}
        >
          Record refund
        </Link>
      ) : null}
      {activeRefundCount === 0 ? (
        <Link
          className={buttonVariants({ variant: "outline" })}
          href={`/money/events/${event.id}/correct`}
        >
          {detail.canCorrectOpening
            ? "Correct opening balance"
            : expense
              ? "Correct or reverse"
              : "Reverse event"}
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground">
          Reverse the active refunds below before correcting this expense.
        </p>
      )}
    </div>
  );
}

function EventShares({ detail }: { detail: MoneyEventDetail }) {
  return (
    <PageSection title="How it affects you both" titleId="event-effects">
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {detail.members.map((member) => {
            const allocation = detail.allocations.find(
              (row) => row.member_id === member.user_id,
            );
            const delta =
              detail.ledger.find((row) => row.member_id === member.user_id)
                ?.receivable_delta_cents ?? 0;
            return (
              <div key={member.user_id} className="rounded-xl bg-muted/50 p-4">
                <h3 className="font-semibold">{member.display_name}</h3>
                {allocation ? (
                  <p className="mt-2 text-sm">
                    {detail.event.type === "refund" ? "Refund share" : "Share"}:{" "}
                    <span className="font-semibold tabular-nums">
                      {formatCentimesAsFrancs(allocation.allocated_cents)}
                    </span>
                  </p>
                ) : null}
                <p className="mt-1 text-sm">
                  Balance change:{" "}
                  <span className="font-semibold tabular-nums">
                    {formatSignedCentimesAsFrancs(delta)}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {delta === 0
                    ? "No change to what you owe each other."
                    : delta > 0
                      ? "Increases what they are owed, or reduces what they owe."
                      : "Reduces what they are owed, or increases what they owe."}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </PageSection>
  );
}

function EventHistory({ detail }: { detail: MoneyEventDetail }) {
  if (!detail.parent && detail.related.length === 0) return null;
  return (
    <PageSection title="Related history" titleId="event-history">
      <ul className="grid list-none gap-2">
        {detail.parent ? (
          <li>
            <Link
              className="flex min-h-11 items-center rounded-xl border p-3 font-medium underline underline-offset-4"
              href={`/money/events/${detail.parent.id}`}
            >
              Original event: {detail.parent.description}
            </Link>
          </li>
        ) : null}
        {detail.related.map((event) => (
          <li key={event.id}>
            <Link
              className="flex min-h-11 items-center justify-between gap-4 rounded-xl border p-3"
              href={`/money/events/${event.id}`}
            >
              <span>
                <span className="block font-medium underline underline-offset-4">
                  {event.description}
                </span>
                <span className="text-sm text-muted-foreground">
                  {event.type} · {event.occurred_on}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">
                {formatCentimesAsFrancs(event.amount_cents)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PageSection>
  );
}

export function EventDetail({ detail }: { detail: MoneyEventDetail }) {
  const { event } = detail;
  const payer = detail.members.find(
    (member) => member.user_id === event.payer_member_id,
  );
  const remaining = detail.remaining.reduce(
    (sum, share) => sum + share.allocatedCents,
    0,
  );
  return (
    <AppPage labelledBy="event-title">
      <PageHeader
        title={<span className="break-words">{event.description}</span>}
        titleId="event-title"
        trailing={
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/money"
          >
            Back to Money
          </Link>
        }
      />
      <Card>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{event.type.replaceAll("_", " ")}</Badge>
            {detail.isReversed ? (
              <Badge variant="warning">Reversed</Badge>
            ) : null}
          </div>
          <p className="text-4xl font-bold tracking-tight tabular-nums">
            {formatCentimesAsFrancs(event.amount_cents)}
          </p>
          <p className="text-sm text-muted-foreground">
            {event.occurred_on}
            {payer
              ? ` · ${event.type === "opening_balance" ? "Owed to" : event.type === "refund" ? "Refund received by" : "Paid by"} ${payer.display_name}`
              : ""}
          </p>
          {event.note ? (
            <p className="whitespace-pre-wrap break-words">{event.note}</p>
          ) : null}
          {detail.receiptPath ? (
            <a
              className="w-fit font-semibold underline underline-offset-4"
              href={`/api/attachments?path=${encodeURIComponent(detail.receiptPath)}`}
              target="_blank"
              rel="noreferrer"
            >
              View receipt <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
          {detail.hasExcessRefund ? (
            <p role="status" className="text-base text-destructive">
              Earlier refunds exceed one person’s original share. Review and
              reverse the affected refunds in the history below before recording
              another refund. Your recorded balance and history are unchanged.
            </p>
          ) : detail.activeRefundCount > 0 ? (
            <p className="text-sm">
              Still refundable:{" "}
              <strong>{formatCentimesAsFrancs(remaining)}</strong>
            </p>
          ) : null}
          <EventActions detail={detail} />
        </CardContent>
      </Card>
      <EventShares detail={detail} />
      <EventHistory detail={detail} />
    </AppPage>
  );
}
