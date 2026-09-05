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
      <div>
        <Link
          href="/money/contexts"
          className={buttonVariants({ variant: "outline" })}
        >
          Paid costs by trip & household record
        </Link>
      </div>
      <DraftList
        confirmDraftAction={confirmDraftAction}
        drafts={model.drafts}
      />
      <EventLedger events={model.events} />
    </AppPage>
  );
}
