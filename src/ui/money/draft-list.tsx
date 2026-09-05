import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MoneyViewModel } from "@/lib/read-models/money";
import { Amount } from "@/ui/layout/amount";
import { EmptyState } from "@/ui/layout/empty-state";
import { PageSection } from "@/ui/layout/page-section";

type DraftListProps = {
  confirmDraftAction: (formData: FormData) => Promise<void>;
  drafts: MoneyViewModel["drafts"];
};

export function DraftList({ drafts }: DraftListProps) {
  return (
    <PageSection title="Drafts" titleId="money-drafts-title">
      {drafts.length === 0 ? (
        <EmptyState title="No drafts to confirm">
          <p>Shopping and recurring expense drafts will appear here.</p>
        </EmptyState>
      ) : (
        <ul className="grid list-none gap-3">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <Card size="sm">
                <CardContent className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{draft.title}</h3>
                      <Badge variant="warning">{draft.source}</Badge>
                      {draft.canConfirm ? null : (
                        <Badge variant="secondary">Needs details</Badge>
                      )}
                    </div>
                    <p
                      className="mt-1 text-sm text-muted-foreground"
                      id={`${draft.id}-blocker`}
                    >
                      {draft.blocker === null
                        ? draft.meta
                        : `${draft.blocker}. ${draft.meta}`}
                    </p>
                  </div>
                  <p className="text-xl font-extrabold">
                    {draft.amount === null ? (
                      "Amount needed"
                    ) : (
                      <Amount value={draft.amount} />
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <Link
                      className={buttonVariants({
                        className: "no-underline",
                        variant: "outline",
                      })}
                      href={`/money/expenses/new?draft=${encodeURIComponent(draft.id)}`}
                    >
                      Review draft
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageSection>
  );
}
