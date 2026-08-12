import type { MoneyViewModel } from "@/lib/read-models/money";
import { Amount } from "@/ui/primitives/amount";
import { Button } from "@/ui/primitives/button";
import { EmptyState } from "@/ui/primitives/empty-state";
import { PageSection } from "@/ui/primitives/page-section";
import { StatusPill } from "@/ui/primitives/status-pill";

type DraftListProps = {
  confirmDraftAction: (formData: FormData) => Promise<void>;
  drafts: MoneyViewModel["drafts"];
};

export function DraftList({ confirmDraftAction, drafts }: DraftListProps) {
  return (
    <PageSection title="Drafts" titleId="money-drafts-title">
      {drafts.length === 0 ? (
        <EmptyState title="No drafts to confirm">
          <p>Shopping and recurring expense drafts will appear here.</p>
        </EmptyState>
      ) : (
        <ul className="money-list">
          {drafts.map((draft) => (
            <li className="card money-row" key={draft.id}>
              <div className="money-row__main">
                <div className="u-cluster">
                  <h3>{draft.title}</h3>
                  <StatusPill tone="warning">{draft.source}</StatusPill>
                </div>
                <p className="money-row__meta">{draft.meta}</p>
              </div>
              <p className="money-row__amount">
                {draft.amount === null ? (
                  "Amount needed"
                ) : (
                  <Amount value={draft.amount} />
                )}
              </p>
              <div className="money-row__actions">
                <form action={confirmDraftAction}>
                  <input name="draftId" type="hidden" value={draft.id} />
                  <Button disabled={draft.amount === null} type="submit">
                    Confirm
                  </Button>
                </form>
                <Button
                  href={`/money/expenses/new?draft=${encodeURIComponent(draft.id)}`}
                  variant="secondary"
                >
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageSection>
  );
}
