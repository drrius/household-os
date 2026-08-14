import { createExpenseAction } from "@/app/(product)/_actions/m7-money";
import { EchoedTextarea } from "@/ui/forms/echoed-control.client";
import { formatCentimesField } from "@/domain/money/chf";
import type { FormAction } from "@/lib/forms/action-state";
import { draftSplitDefaults } from "@/lib/forms/money";
import { ExpenseAmountAndSplitFields } from "@/ui/forms/expense-split-fields.client";
import { FormField, FormFields, FormSection } from "@/ui/forms/form-page";
import { EchoedSelect } from "@/ui/forms/form-select.client";

type Member = { user_id: string; display_name: string };
type Option = { id: string; name: string };
type Draft = {
  id: string;
  description: string;
  amount_cents: number | null;
  payer_member_id: string | null;
  occurred_on: string;
  proposed_allocations: unknown;
};

function centsInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return formatCentimesField(value);
}

function DetailFields({ categories }: { categories: readonly Option[] }) {
  return (
    <FormSection legend="Details">
      <FormField label="Category" optional>
        <EchoedSelect
          items={[
            { label: "Other", value: "" },
            ...categories.map((category) => ({
              label: category.name,
              value: category.id,
            })),
          ]}
          name="categoryId"
        />
      </FormField>
      <FormField label="Note" optional>
        <EchoedTextarea maxLength={4000} name="note" />
      </FormField>
    </FormSection>
  );
}

export function ExpenseForm({
  action = createExpenseAction,
  categories,
  draft,
  members,
  occurredOn,
  viewerId,
}: {
  action?: FormAction;
  categories: readonly Option[];
  draft: Draft | null;
  members: readonly Member[];
  occurredOn: string;
  viewerId: string;
}) {
  const normalizedDraft = draft ?? {
    id: "",
    description: "",
    amount_cents: null,
    payer_member_id: null,
    occurred_on: occurredOn,
    proposed_allocations: [],
  };
  const firstMember = members[0];
  const secondMember = members[1];
  const split =
    firstMember === undefined || secondMember === undefined
      ? { mode: "equal" as const, allocationsByMemberId: {} }
      : draftSplitDefaults(
          normalizedDraft.amount_cents,
          normalizedDraft.payer_member_id,
          [firstMember.user_id, secondMember.user_id],
          normalizedDraft.proposed_allocations,
        );
  return (
    <FormFields
      action={action}
      submitLabel={draft ? "Post draft" : "Post expense"}
    >
      <input name="idempotencyKey" type="hidden" value={crypto.randomUUID()} />
      {draft ? <input name="draftId" type="hidden" value={draft.id} /> : null}
      <ExpenseAmountAndSplitFields
        initialAmount={centsInput(normalizedDraft.amount_cents)}
        initialDescription={normalizedDraft.description}
        initialExactCents={split.allocationsByMemberId}
        initialMode={split.mode}
        initialPayerMemberId={normalizedDraft.payer_member_id ?? viewerId}
        isDraft={draft !== null}
        members={members}
        occurredOn={normalizedDraft.occurred_on}
      />
      <DetailFields categories={categories} />
    </FormFields>
  );
}
