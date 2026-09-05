import Link from "next/link";

import { confirmTodayExpenseDraft } from "@/app/(product)/_actions/routines";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Amount } from "@/ui/layout/amount";
import { AppPage } from "@/ui/layout/app-page";
import { EmptyState } from "@/ui/layout/empty-state";
import { PageHeader } from "@/ui/layout/page-header";
import { PageSection } from "@/ui/layout/page-section";
import { ProgressMeter } from "@/ui/layout/progress-meter";
import { MealSection } from "@/ui/today/meal-section";
import { RoutineList } from "@/ui/today/routine-list";
import type {
  DraftGlance,
  ShoppingGlance,
  TodayViewModel,
} from "@/ui/today/today-view-model";

type BalancePill = NonNullable<TodayViewModel["balancePill"]>;

function BalanceStatus({ balance }: { balance: BalancePill }) {
  switch (balance.kind) {
    case "partner_owes_you":
      return (
        <Link className="no-underline" href="/money">
          <Badge variant="accent">
            {balance.partnerName} owes you <Amount value={balance.amount} />
          </Badge>
        </Link>
      );
    case "you_owe_partner":
      return (
        <Link className="no-underline" href="/money">
          <Badge variant="warning">
            You owe {balance.partnerName} <Amount value={balance.amount} />
          </Badge>
        </Link>
      );
    case "settled":
      return (
        <Link className="no-underline" href="/money">
          <Badge variant="success">
            Settled <Amount value={balance.amount} />
          </Badge>
        </Link>
      );
    default: {
      const exhaustiveBalance: never = balance.kind;
      return exhaustiveBalance;
    }
  }
}

function progressLabel(progress: TodayViewModel["progress"]): string {
  if (progress.totalCount === 0) return "Nothing due today";
  return `${progress.completedCount} down, ${progress.totalCount - progress.completedCount} to go`;
}

function RoutineSections({ view }: { view: TodayViewModel }) {
  const open = view.routinesToday.filter((row) => row.tone !== "completed");
  const completed = view.routinesToday.filter(
    (row) => row.tone === "completed",
  );
  return (
    <div className="flex flex-col gap-6 lg:col-span-2">
      {view.overdue.length > 0 ? (
        <PageSection title="Still to do" titleId="today-overdue-title">
          <RoutineList rows={view.overdue} />
        </PageSection>
      ) : null}
      <PageSection title="Today's routines" titleId="today-routines-title">
        {open.length > 0 ? (
          <RoutineList rows={open} />
        ) : (
          <div className="grid gap-2 py-4">
            <p className="font-medium">
              {view.overdue.length > 0
                ? "Nothing else due today"
                : "A little breathing room"}
            </p>
            <p className="text-base text-muted-foreground sm:text-sm">
              {completed.length > 0
                ? "Today's routines are taken care of."
                : "No routines scheduled for today."}
            </p>
            <Link className="w-fit" href="/home/routines/new">
              Add a routine
            </Link>
          </div>
        )}
      </PageSection>
      {completed.length > 0 ? (
        <details className="border-t pt-3">
          <summary className="min-h-11 cursor-pointer text-base text-muted-foreground sm:text-sm">
            Done today · {completed.length}
          </summary>
          <RoutineList rows={completed} />
        </details>
      ) : null}
    </div>
  );
}

function itemCountLabel(itemCount: number): string {
  return `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
}

function ShoppingCard({ shopping }: { shopping: ShoppingGlance }) {
  switch (shopping.kind) {
    case "empty":
      return (
        <p className="text-base text-muted-foreground sm:text-sm">
          Nothing on the list. <Link href="/groceries/new">Add groceries</Link>
        </p>
      );
    case "list":
      return (
        <Link className="block no-underline" href="/groceries">
          <Card size="sm">
            <CardContent className="grid gap-1">
              <Badge className="mb-2" variant="accent">
                Ready
              </Badge>
              <strong>{itemCountLabel(shopping.itemCount)}</strong>
              <p className="text-sm text-muted-foreground">
                on the shared list
              </p>
            </CardContent>
          </Card>
        </Link>
      );
    case "live":
      return (
        <Link className="block no-underline" href="/groceries">
          <Card className="bg-success-soft" size="sm">
            <CardHeader>
              <CardTitle>Shopping now</CardTitle>
              <CardAction>
                <Badge variant="success">Live</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-1">
              <strong>{shopping.shopperNames.join(" and ")}</strong>
              <p className="text-sm text-muted-foreground">
                {itemCountLabel(shopping.itemCount)} on the list
              </p>
            </CardContent>
          </Card>
        </Link>
      );
    default: {
      const exhaustiveShopping: never = shopping;
      return exhaustiveShopping;
    }
  }
}

function draftReasonId(draftId: string): string {
  return `${draftId}-needs-details`;
}

function DraftActions({ draft }: { draft: DraftGlance }) {
  switch (draft.kind) {
    case "ready":
      return (
        <div className="flex flex-wrap gap-2">
          <form action={confirmTodayExpenseDraft.bind(null, draft.draftId)}>
            <Button type="submit">Confirm</Button>
          </form>
          <Link
            className={buttonVariants({
              className: "no-underline",
              variant: "outline",
            })}
            href={`/money/expenses/new?draft=${encodeURIComponent(draft.draftId)}`}
          >
            Edit
          </Link>
        </div>
      );
    case "incomplete":
      return (
        <div className="flex flex-wrap gap-2">
          <Button
            aria-describedby={
              draft.blocker === null ? undefined : draftReasonId(draft.draftId)
            }
            disabled
          >
            Confirm
          </Button>
          <Link
            className={buttonVariants({
              className: "no-underline",
              variant: "outline",
            })}
            href={`/money/expenses/new?draft=${encodeURIComponent(draft.draftId)}`}
          >
            Edit
          </Link>
        </div>
      );
    default: {
      const exhaustiveDraft: never = draft;
      return exhaustiveDraft;
    }
  }
}

function MoneySection({ drafts }: { drafts: readonly DraftGlance[] }) {
  if (drafts.length === 0) return null;
  return (
    <PageSection title="Money requiring attention" titleId="today-money-title">
      {drafts.length > 0 ? (
        <div className="flex flex-col gap-4">
          {drafts.map((draft) => (
            <Card key={draft.draftId} size="sm">
              <CardHeader>
                <CardTitle>{draft.title}</CardTitle>
                <CardAction>
                  <Badge
                    variant={draft.kind === "ready" ? "warning" : "secondary"}
                  >
                    {draft.kind === "ready" ? "Confirm" : "Needs details"}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    {draft.source === "shopping"
                      ? "Shopping draft"
                      : "Recurring draft"}
                  </p>
                  <div className="grid gap-1">
                    {draft.amount === null ? (
                      <strong>Amount needed</strong>
                    ) : (
                      <strong>
                        <Amount value={draft.amount} />
                      </strong>
                    )}
                    {draft.kind === "incomplete" && draft.blocker !== null ? (
                      <p
                        className="text-sm text-muted-foreground"
                        id={draftReasonId(draft.draftId)}
                      >
                        {draft.blocker}
                      </p>
                    ) : null}
                  </div>
                  <DraftActions draft={draft} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No drafts waiting">
          <p>There is nothing to confirm.</p>
        </EmptyState>
      )}
    </PageSection>
  );
}

export function TodayScreen({ view }: { view: TodayViewModel }) {
  const summary = progressLabel(view.progress);
  return (
    <AppPage labelledBy="today-title">
      <PageHeader
        eyebrow={view.dateLabel}
        title={`Hoi ${view.greetingName}`}
        titleId="today-title"
        trailing={
          view.balancePill === null ? null : (
            <BalanceStatus balance={view.balancePill} />
          )
        }
      />
      {view.progress.totalCount > 0 ? (
        <ProgressMeter
          id="today-progress"
          label="Household work today"
          max={view.progress.totalCount}
          value={view.progress.completedCount}
          valueLabel={summary}
          valueText={summary}
        />
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <RoutineSections view={view} />
        <div className="flex flex-col gap-4">
          <MealSection meals={view.meals} />
          <PageSection title="Shopping" titleId="today-shopping-title">
            <ShoppingCard shopping={view.shopping} />
          </PageSection>
          <MoneySection drafts={view.pendingDrafts} />
        </div>
      </div>
    </AppPage>
  );
}
