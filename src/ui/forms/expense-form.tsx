import { createExpenseAction } from "@/app/(product)/_actions/m7-money";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { draftSplitDefaults, formatCentimesField } from "@/lib/forms/m7";
import { ExpenseSplitFields } from "@/ui/forms/expense-split-fields.client";
import {
  FormField,
  FormFields,
  FormSection,
  selectClassName,
} from "@/ui/forms/form-page";

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

function ExpenseFields({
  draft,
  isDraft,
  members,
  viewerId,
}: {
  draft: Draft;
  isDraft: boolean;
  members: readonly Member[];
  viewerId: string;
}) {
  return (
    <FormSection legend="Expense">
      <FormField label="Description">
        <Input
          defaultValue={draft.description}
          maxLength={200}
          name="description"
          readOnly={isDraft}
          required
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Amount in CHF">
          <Input
            defaultValue={centsInput(draft.amount_cents)}
            inputMode="decimal"
            name="amount"
            placeholder="0.00"
            required
          />
        </FormField>
        <FormField label="Date">
          <Input
            defaultValue={draft.occurred_on}
            name="occurredOn"
            required
            type="date"
          />
        </FormField>
      </div>
      <FormField label="Payer">
        <select
          className={selectClassName}
          defaultValue={draft.payer_member_id ?? viewerId}
          name="payerMemberId"
        >
          {members.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.display_name}
            </option>
          ))}
        </select>
      </FormField>
    </FormSection>
  );
}

function DetailFields({ categories }: { categories: readonly Option[] }) {
  return (
    <FormSection legend="Details">
      <FormField label="Category">
        <select className={selectClassName} name="categoryId">
          <option value="">Other</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Note">
        <Textarea maxLength={4000} name="note" />
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
  action?: (formData: FormData) => Promise<void>;
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
      <ExpenseFields
        draft={normalizedDraft}
        isDraft={draft !== null}
        members={members}
        viewerId={viewerId}
      />
      <DetailFields categories={categories} />
      <ExpenseSplitFields
        initialExactCents={split.allocationsByMemberId}
        initialMode={split.mode}
        members={members}
      />
    </FormFields>
  );
}
