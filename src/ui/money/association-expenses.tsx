import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { costTargetHref, type CostTarget } from "@/domain/money/cost-target";
import type { AssociationExpense } from "@/lib/connected/cost-associations";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { AppPage } from "@/ui/layout/app-page";
export function AssociationExpenses({
  target,
  title,
  expenses,
  hasMore,
  older,
}: {
  target: CostTarget;
  title: string;
  expenses: AssociationExpense[];
  hasMore: boolean;
  older: boolean;
}) {
  const base = `/money/contexts/${target.kind}/${target.id}/existing`;
  const query = new URLSearchParams(
    target.bookingId ? { booking: target.bookingId } : {},
  );
  const next = olderExpensesHref(base, query, expenses.at(-1));
  return (
    <AppPage labelledBy="existing-expenses-title">
      <Link
        className="min-h-11 content-center text-muted-foreground underline"
        href={costTargetHref(target)}
      >
        Back to {title}
      </Link>
      <header className="grid gap-2">
        <h1
          id="existing-expenses-title"
          className="text-3xl font-semibold tracking-tight"
        >
          Choose a recorded expense
        </h1>
        <p className="max-w-prose text-muted-foreground">
          Associate an existing payment with {title}. You’ll review its current
          association before saving. This does not record another payment.
        </p>
      </header>
      {older && (
        <Link
          className={buttonVariants({
            variant: "outline",
            className: "self-start",
          })}
          href={`${base}?${query}`}
        >
          Latest expenses
        </Link>
      )}
      {expenses.length === 0 ? (
        <p className="py-5 text-muted-foreground">
          {older
            ? "No earlier expenses."
            : "No recorded expenses yet. Add a payment from the costs page after either of you pays."}
        </p>
      ) : (
        <ul role="list" className="divide-y divide-border">
          {expenses.map((expense) => (
            <AssociationExpenseRow
              key={expense.id}
              expense={expense}
              href={`${base}/${expense.id}?${query}`}
            />
          ))}
        </ul>
      )}
      {hasMore && (
        <Link
          className={buttonVariants({
            variant: "outline",
            className: "self-start",
          })}
          href={next}
        >
          Earlier expenses
        </Link>
      )}
    </AppPage>
  );
}

function AssociationExpenseRow({
  expense,
  href,
}: {
  expense: AssociationExpense;
  href: string;
}) {
  return (
    <li>
      <Link
        className="flex min-h-16 items-center justify-between gap-4 py-4"
        href={href}
      >
        <span className="grid min-w-0 gap-1">
          <span className="break-words font-medium underline">
            {expense.description}
          </span>
          <span className="text-sm text-muted-foreground">
            {expense.occurred_on}
            {expense.type === "replacement" ? " · Corrected payment" : ""}
          </span>
        </span>
        <span className="shrink-0 tabular-nums">
          {formatCentimesAsFrancs(expense.amount_cents)}
        </span>
      </Link>
    </li>
  );
}

function olderExpensesHref(
  base: string,
  query: URLSearchParams,
  last?: AssociationExpense,
) {
  const next = new URLSearchParams(query);
  if (last) {
    next.set("beforeOn", last.occurred_on);
    next.set("beforeId", last.id);
  }
  return `${base}?${next}`;
}
