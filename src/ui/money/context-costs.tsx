import { CostHeader } from "./cost-header";
import { CostActivityRow } from "./cost-activity-row";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  costTargetHref,
  type CostRecord,
  type CostTarget,
} from "@/domain/money/cost-target";
import type { CostContextPage } from "@/lib/connected/cost-context";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { AppPage } from "@/ui/layout/app-page";

export function ContextCosts({
  target,
  record,
  booking,
  costs,
  members,
  older = false,
  saved = false,
  associationSaved = false,
}: {
  target: CostTarget;
  record: CostRecord;
  booking: CostRecord | null;
  costs: CostContextPage;
  members: readonly { user_id: string; display_name: string }[];
  older?: boolean;
  saved?: boolean;
  associationSaved?: boolean;
}) {
  const base = costTargetHref(target);
  const next = new URLSearchParams(
    target.bookingId ? { booking: target.bookingId } : {},
  );
  if (costs.next_cursor) {
    next.set("beforeOn", costs.next_cursor.occurred_on);
    next.set("beforeId", costs.next_cursor.id);
  }
  return (
    <AppPage labelledBy="context-cost-title">
      <CostHeader target={target} record={record} booking={booking} />
      <CostSaveStatus saved={saved} associationSaved={associationSaved} />
      <CostTotal paidCents={costs.paid_cents} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">
          {older ? "Earlier activity" : "Payment activity"}
        </h2>
        {older && (
          <Link className={buttonVariants({ variant: "outline" })} href={base}>
            Latest activity
          </Link>
        )}
      </div>
      {costs.events.length === 0 ? (
        <p className="py-4 text-muted-foreground">
          {older
            ? "There is no earlier activity."
            : "No paid expenses yet. Add an expense after either of you pays for something."}
        </p>
      ) : (
        <ul role="list" className="divide-y divide-border">
          {costs.events.map((event) => (
            <CostActivityRow
              key={event.id}
              event={event}
              target={target}
              members={members}
            />
          ))}
        </ul>
      )}
      {costs.next_cursor && (
        <Link
          className={buttonVariants({
            variant: "outline",
            className: "self-start",
          })}
          href={`/money/contexts/${target.kind}/${target.id}?${next}`}
        >
          Earlier activity
        </Link>
      )}
    </AppPage>
  );
}

function CostTotal({ paidCents }: { paidCents: string }) {
  return (
    <div className="grid gap-2 py-5">
      <p className="text-base text-muted-foreground sm:text-sm">
        Total paid after refunds and corrections
      </p>
      <p className="break-words text-3xl font-semibold tracking-tight tabular-nums">
        {formatCentimesAsFrancs(BigInt(paidCents))}
      </p>
      <p className="max-w-prose text-base text-muted-foreground sm:text-sm">
        This is what you paid together. Who owes whom is calculated in{" "}
        <Link className="underline" href="/money">
          Money
        </Link>
        . Estimates and unpaid bookings do not count here.
      </p>
    </div>
  );
}

function CostSaveStatus({
  saved,
  associationSaved,
}: {
  saved: boolean;
  associationSaved: boolean;
}) {
  return (
    <>
      {" "}
      {saved && (
        <p role="status" className="rounded-xl bg-secondary p-4">
          Expense saved. Your payment is recorded in Money.
        </p>
      )}
      {associationSaved && (
        <p role="status" className="rounded-xl bg-secondary p-4">
          Association request saved. No new payment was recorded.
        </p>
      )}
    </>
  );
}
