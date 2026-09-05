import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  costExpenseHref,
  costTargetHref,
  type CostRecord,
  type CostTarget,
} from "@/domain/money/cost-target";
export function CostHeader({
  target,
  record,
  booking,
}: {
  target: CostTarget;
  record: CostRecord;
  booking: CostRecord | null;
}) {
  const archived = record.archived_at || booking?.archived_at;
  return (
    <>
      {" "}
      <div className="text-base sm:text-sm">
        <Link
          href={
            target.bookingId
              ? costTargetHref({ kind: target.kind, id: target.id })
              : `/money/contexts?kind=${target.kind}${record.archived_at ? "&archived=true" : ""}`
          }
          className="inline-flex min-h-11 items-center gap-2 text-muted-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
          {target.bookingId ? "All plan costs" : "Paid costs"}
        </Link>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-2">
          <p className="text-base text-muted-foreground sm:text-sm">
            {booking ? record.title : "Paid costs"}
            {archived ? " · Archived" : ""}
          </p>
          <h1
            id="context-cost-title"
            className="break-words text-3xl font-semibold tracking-tight text-balance"
          >
            {booking?.title ?? record.title}
          </h1>
        </div>
        {!archived && (
          <div className="flex flex-wrap gap-2">
            <Link className={buttonVariants()} href={costExpenseHref(target)}>
              <Plus aria-hidden="true" className="size-4 shrink-0" />
              Add expense
            </Link>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/money/contexts/${target.kind}/${target.id}/existing${target.bookingId ? `?booking=${target.bookingId}` : ""}`}
            >
              Link recorded expense
            </Link>
          </div>
        )}
      </header>
    </>
  );
}
