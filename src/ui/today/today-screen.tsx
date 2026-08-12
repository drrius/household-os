import Link from "next/link";

import { confirmTodayExpenseDraft } from "@/app/(product)/_actions/routines";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { RoutineList } from "@/ui/today/routine-list";
import type {
  DraftGlance,
  MealGlance,
  ShoppingGlance,
  TodayViewModel,
} from "@/ui/today/today-view-model";

type BalancePill = NonNullable<TodayViewModel["balancePill"]>;

function BalanceStatus({ balance }: { balance: BalancePill }) {
  switch (balance.kind) {
    case "partner_owes_you":
      return (
        <Badge variant="accent">
          {balance.partnerName} owes you <Amount value={balance.amount} />
        </Badge>
      );
    case "you_owe_partner":
      return (
        <Badge variant="warning">
          You owe {balance.partnerName} <Amount value={balance.amount} />
        </Badge>
      );
    case "settled":
      return (
        <Badge variant="success">
          Settled <Amount value={balance.amount} />
        </Badge>
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
  return (
    <div className="flex flex-col gap-4">
      <PageSection title="Overdue" titleId="today-overdue-title">
        {view.overdue.length > 0 ? (
          <RoutineList rows={view.overdue} />
        ) : (
          <EmptyState title="Nothing overdue">
            <p>The household is caught up.</p>
          </EmptyState>
        )}
      </PageSection>
      <PageSection title="Today's routines" titleId="today-routines-title">
        {view.routinesToday.length > 0 ? (
          <RoutineList rows={view.routinesToday} />
        ) : (
          <EmptyState title="No routines today">
            <p>There is no scheduled household work for today.</p>
          </EmptyState>
        )}
      </PageSection>
    </div>
  );
}

function mealSlotLabel(slot: MealGlance["slot"]): string {
  switch (slot) {
    case "breakfast":
      return "Breakfast";
    case "lunch":
      return "Lunch";
    case "dinner":
      return "Dinner";
    case null:
      return "Meal";
    default: {
      const exhaustiveSlot: never = slot;
      return exhaustiveSlot;
    }
  }
}

function MealSection({ meals }: { meals: readonly MealGlance[] }) {
  return (
    <PageSection title="Meal and prep" titleId="today-meals-title">
      {meals.length > 0 ? (
        <div className="flex flex-col gap-4">
          {meals.map((meal) => (
            <Card className="bg-secondary" key={meal.entryId} size="sm">
              <CardHeader>
                <CardTitle>{mealSlotLabel(meal.slot)}</CardTitle>
                <CardAction>
                  <Badge variant="accent">
                    {meal.day === "today" ? "Today" : "Tomorrow"}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <strong>{meal.title}</strong>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No meal planned">
          <p>Today’s meal plan is open.</p>
        </EmptyState>
      )}
    </PageSection>
  );
}

function itemCountLabel(itemCount: number): string {
  return `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
}

function ShoppingCard({ shopping }: { shopping: ShoppingGlance }) {
  switch (shopping.kind) {
    case "empty":
      return (
        <EmptyState title="The list is empty">
          <p>There is nothing waiting to be bought.</p>
        </EmptyState>
      );
    case "list":
      return (
        <Card size="sm">
          <CardContent className="grid gap-1">
            <Badge className="mb-2" variant="accent">
              Ready
            </Badge>
            <strong>{itemCountLabel(shopping.itemCount)}</strong>
            <p className="text-xs text-muted-foreground">on the shared list</p>
          </CardContent>
        </Card>
      );
    case "live":
      return (
        <Card className="bg-success-soft" size="sm">
          <CardHeader>
            <CardTitle>Shopping now</CardTitle>
            <CardAction>
              <Badge variant="success">Live</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-1">
            <strong>{shopping.shopperNames.join(" and ")}</strong>
            <p className="text-xs text-muted-foreground">
              {itemCountLabel(shopping.itemCount)} on the list
            </p>
          </CardContent>
        </Card>
      );
    default: {
      const exhaustiveShopping: never = shopping;
      return exhaustiveShopping;
    }
  }
}

function DraftActions({ draft }: { draft: DraftGlance }) {
  switch (draft.kind) {
    case "ready":
      return (
        <div className="flex flex-wrap gap-2">
          <form action={confirmTodayExpenseDraft.bind(null, draft.draftId)}>
            <Button type="submit">Confirm</Button>
          </form>
          <Button nativeButton={false} render={<Link href="/money" />} variant="outline">
            Edit
          </Button>
        </div>
      );
    case "incomplete":
      return (
        <div className="flex flex-wrap gap-2">
          <Button disabled>Confirm</Button>
          <Button nativeButton={false} render={<Link href="/money" />} variant="outline">
            Edit
          </Button>
        </div>
      );
    default: {
      const exhaustiveDraft: never = draft;
      return exhaustiveDraft;
    }
  }
}

function MoneySection({ drafts }: { drafts: readonly DraftGlance[] }) {
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
                  <p className="text-xs text-muted-foreground">
                    {draft.source === "shopping"
                      ? "Shopping draft"
                      : "Recurring draft"}
                  </p>
                  {draft.amount === null ? (
                    <strong>Amount needed</strong>
                  ) : (
                    <strong>
                      <Amount value={draft.amount} />
                    </strong>
                  )}
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
        eyebrow={`${view.dateLabel} · ${summary}`}
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
          label="Today's routines"
          max={view.progress.totalCount}
          value={view.progress.completedCount}
          valueLabel={summary}
        />
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <RoutineSections view={view} />
        <div className="flex flex-col gap-4">
          <MealSection meals={view.meals} />
          <PageSection title="Shopping" titleId="today-shopping-title">
            <ShoppingCard shopping={view.shopping} />
          </PageSection>
        </div>
        <div className="flex flex-col gap-4">
          <MoneySection drafts={view.pendingDrafts} />
        </div>
      </div>
    </AppPage>
  );
}
