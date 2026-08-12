import type { MoneyViewModel } from "@/lib/read-models/money";
import { AppPage } from "@/ui/primitives/app-page";
import { PageHeader } from "@/ui/primitives/page-header";

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
      <PageHeader titleId="money-title" title="Money" />
      <MoneyHero hero={model.hero} explanation={model.explanation} />
      <DraftList
        confirmDraftAction={confirmDraftAction}
        drafts={model.drafts}
      />
      <EventLedger events={model.events} />
    </AppPage>
  );
}
