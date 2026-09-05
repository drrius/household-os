import { dismissDraftAction } from "@/app/(product)/_actions/money";
import { MoneyCommandForm } from "@/ui/money/command-form.client";
import { notFound } from "next/navigation";

import { requireMemberContext } from "@/lib/auth/member-context";
import { loadMoneyFormOptions } from "@/lib/forms/options";
import { loadMoneyDraft } from "@/lib/read-models/money-draft";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { ExpenseForm } from "@/ui/forms/expense-form";
import { FormPage } from "@/ui/forms/form-page";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const [query, options, member] = await Promise.all([
    searchParams,
    loadMoneyFormOptions(),
    requireMemberContext(),
  ]);
  const draft = query.draft ? await loadMoneyDraft(query.draft) : null;
  if (query.draft && !draft) notFound();
  return (
    <FormPage
      backHref="/money"
      description={
        draft
          ? "Review the amount, payer, and split before this draft changes your balance."
          : "Record something one of you already paid for. The balance changes after you save."
      }
      title={draft ? "Review expense draft" : "New expense"}
    >
      <ExpenseForm
        categories={options.categories}
        draft={draft}
        members={options.members}
        occurredOn={zurichCivilDate()}
        viewerId={member.userId}
      />
      {draft ? (
        <div className="mt-8 border-t pt-6">
          <p className="mb-3 text-sm text-muted-foreground">
            Not a shared expense? Dismiss this draft without changing your
            balance.
          </p>
          <MoneyCommandForm
            action={dismissDraftAction}
            label="Dismiss draft"
            idempotencyKey={crypto.randomUUID()}
            fields={{ draftId: draft.id }}
          />
        </div>
      ) : null}
    </FormPage>
  );
}
