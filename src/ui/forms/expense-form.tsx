import type { ReactNode } from "react";
import { ReceiptField } from "@/ui/money/receipt-field.client";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
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
export type ExpenseDraftDefaults = {
  id: string;
  description: string;
  amount_cents: number | null;
  payer_member_id: string | null;
  occurred_on: string;
  proposed_allocations: unknown;
  category_id?: string | null;
  note?: string | null;
  receipt_path?: string | null;
  receipt_total_cents?: number | null;
};

function centsInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return formatCentimesField(value);
}

function DetailFields({
  categories,
  draft,
}: {
  categories: readonly Option[];
  draft: ExpenseDraftDefaults | null;
}) {
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
          initialValue={draft?.category_id ?? ""}
          name="categoryId"
        />
      </FormField>
      <FormField label="Note" optional>
        <EchoedTextarea
          maxLength={4000}
          name="note"
          initialValue={draft?.note ?? ""}
        />
      </FormField>
      <ReceiptField initialPath={draft?.receipt_path} />
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
  submitLabel,
  children,
  editing = false,
}: {
  action?: FormAction;
  categories: readonly Option[];
  draft: ExpenseDraftDefaults | null;
  members: readonly Member[];
  occurredOn: string;
  viewerId: string;
  submitLabel?: string;
  children?: ReactNode;
  editing?: boolean;
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
      submitLabel={
        submitLabel ?? (draft ? "Post expense draft" : "Post expense")
      }
    >
      <input name="idempotencyKey" type="hidden" value={crypto.randomUUID()} />
      {draft && !editing ? (
        <input name="draftId" type="hidden" value={draft.id} />
      ) : null}
      {children}
      {draft?.receipt_total_cents != null ? (
        <p className="text-base text-muted-foreground sm:text-sm">
          Receipt total: {formatCentimesAsFrancs(draft.receipt_total_cents)}.
          Enter only the shared amount below.
        </p>
      ) : null}
      <ExpenseAmountAndSplitFields
        initialAmount={centsInput(normalizedDraft.amount_cents)}
        initialDescription={normalizedDraft.description}
        initialExactCents={split.allocationsByMemberId}
        initialMode={split.mode}
        initialPayerMemberId={normalizedDraft.payer_member_id ?? viewerId}
        isDraft={draft !== null && !editing}
        members={members}
        occurredOn={normalizedDraft.occurred_on}
      />
      <DetailFields categories={categories} draft={draft} />
    </FormFields>
  );
}
