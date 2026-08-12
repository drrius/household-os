import { confirmTodayExpenseDraft } from "@/app/(product)/_actions/routines";
import { Amount } from "@/ui/primitives/amount";
import { AppPage } from "@/ui/primitives/app-page";
import { Button } from "@/ui/primitives/button";
import { Card } from "@/ui/primitives/card";
import { EmptyState } from "@/ui/primitives/empty-state";
import { PageHeader } from "@/ui/primitives/page-header";
import { PageSection } from "@/ui/primitives/page-section";
import { ProgressMeter } from "@/ui/primitives/progress-meter";
import { StatusPill } from "@/ui/primitives/status-pill";
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
        <StatusPill tone="accent">
          {balance.partnerName} owes you <Amount value={balance.amount} />
        </StatusPill>
      );
    case "you_owe_partner":
      return (
        <StatusPill tone="warning">
          You owe {balance.partnerName} <Amount value={balance.amount} />
        </StatusPill>
      );
    case "settled":
      return (
        <StatusPill tone="success">
          Settled <Amount value={balance.amount} />
        </StatusPill>
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
    <div className="today-column">
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
        <div className="today-card-list">
          {meals.map((meal) => (
            <Card
              header={
                <>
                  <span>{mealSlotLabel(meal.slot)}</span>
                  <StatusPill tone="accent">
                    {meal.day === "today" ? "Today" : "Tomorrow"}
                  </StatusPill>
                </>
              }
              key={meal.entryId}
              tone="meal"
            >
              <strong>{meal.title}</strong>
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
        <Card header={<StatusPill tone="accent">Ready</StatusPill>}>
          <strong>{itemCountLabel(shopping.itemCount)}</strong>
          <p className="today-card-meta">on the shared list</p>
        </Card>
      );
    case "live":
      return (
        <Card
          header={
            <>
              <span>Shopping now</span>
              <StatusPill tone="success">Live</StatusPill>
            </>
          }
          tone="success"
        >
          <strong>{shopping.shopperNames.join(" and ")}</strong>
          <p className="today-card-meta">
            {itemCountLabel(shopping.itemCount)} on the list
          </p>
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
        <div className="today-draft-actions">
          <form action={confirmTodayExpenseDraft.bind(null, draft.draftId)}>
            <Button type="submit">Confirm</Button>
          </form>
          <Button href="/money" variant="secondary">
            Edit
          </Button>
        </div>
      );
    case "incomplete":
      return (
        <div className="today-draft-actions">
          <Button disabled>Confirm</Button>
          <Button href="/money" variant="secondary">
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
        <div className="today-card-list">
          {drafts.map((draft) => (
            <Card
              header={
                <>
                  <span>{draft.title}</span>
                  <StatusPill
                    tone={draft.kind === "ready" ? "warning" : "default"}
                  >
                    {draft.kind === "ready" ? "Confirm" : "Needs details"}
                  </StatusPill>
                </>
              }
              key={draft.draftId}
            >
              <div className="u-stack">
                <p className="today-card-meta">
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
      <div className="today-grid">
        <RoutineSections view={view} />
        <div className="today-column">
          <MealSection meals={view.meals} />
          <PageSection title="Shopping" titleId="today-shopping-title">
            <ShoppingCard shopping={view.shopping} />
          </PageSection>
        </div>
        <div className="today-column">
          <MoneySection drafts={view.pendingDrafts} />
        </div>
      </div>
    </AppPage>
  );
}
