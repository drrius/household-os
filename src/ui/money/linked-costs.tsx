import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  costExpenseHref,
  costTargetHref,
  type CostTarget,
} from "@/domain/money/cost-target";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";

export function LinkedCosts({
  target,
  paidCents,
  archived,
}: {
  target: CostTarget;
  paidCents: string;
  archived: boolean;
}) {
  return (
    <section
      className="grid gap-3 rounded-2xl border p-4"
      aria-labelledby="linked-costs-title"
    >
      <h2
        id="linked-costs-title"
        className="font-heading text-xl font-semibold"
      >
        Paid expenses
      </h2>
      <p className="text-2xl font-semibold tabular-nums">
        {formatCentimesAsFrancs(BigInt(paidCents))}
      </p>
      <p className="text-sm text-muted-foreground">
        Total paid after refunds and corrections. Estimates stay separate;{" "}
        <Link href="/money">Money shows who owes whom</Link>.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          className={buttonVariants({ variant: "outline" })}
          href={costTargetHref(target)}
        >
          View paid expenses
        </Link>
        {!archived ? (
          <>
            <Link className={buttonVariants()} href={costExpenseHref(target)}>
              Add paid expense
            </Link>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/money/contexts/${target.kind}/${target.id}/existing${target.bookingId ? `?booking=${target.bookingId}` : ""}`}
            >
              Link recorded expense
            </Link>
          </>
        ) : null}
      </div>
    </section>
  );
}
