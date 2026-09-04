import type { MoneyViewModel } from "@/lib/read-models/money";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";

import { DraftList } from "./draft-list";
import { EventLedger } from "./event-ledger";
import { MoneyHero } from "./money-hero";

type MoneyScreenProps = {
  confirmDraftAction: (formData: FormData) => Promise<void>;
  model: MoneyViewModel;
};

export function MoneyScreen({ confirmDraftAction, model }: MoneyScreenProps) {
  return (
    <AppPage labelledBy="money-title">
      <PageHeader
        titleId="money-title"
        title="Money"
        trailing={
          <Link
            className={buttonVariants({
              className: "no-underline",
              variant: "outline",
            })}
            href="/money/expenses/new"
          >
            Add expense
          </Link>
        }
      />
      <MoneyHero
        hero={model.hero}
        explanation={model.explanation}
        hasOpeningBalance={model.hasOpeningBalance}
      />
      <DraftList
        confirmDraftAction={confirmDraftAction}
        drafts={model.drafts}
      />
      <Link
        className="flex min-h-11 items-center font-semibold underline underline-offset-4"
        href="/money/recurring"
      >
        Manage recurring expenses
      </Link>
      <EventLedger events={model.events} />
    </AppPage>
  );
}
