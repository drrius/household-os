import { createExpenseAction } from "@/app/(product)/_actions/m7-money";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
};

function centsInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}

function ExpenseFields({
  draft,
  members,
  viewerId,
}: {
  draft: Draft | null;
  members: readonly Member[];
  viewerId: string;
}) {
  return (
    <FormSection legend="Expense">
      <FormField label="Description">
        <Input
          defaultValue={draft?.description}
          maxLength={200}
          name="description"
          required
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Amount in CHF">
          <Input
            defaultValue={centsInput(draft?.amount_cents)}
            inputMode="decimal"
            name="amount"
            placeholder="0.00"
            required
          />
        </FormField>
        <FormField label="Date">
          <Input
            defaultValue={draft?.occurred_on}
            name="occurredOn"
            required
            type="date"
          />
        </FormField>
      </div>
      <FormField label="Payer">
        <select
          className={selectClassName}
          defaultValue={draft?.payer_member_id ?? viewerId}
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

function SplitFields({
  categories,
  members,
}: {
  categories: readonly Option[];
  members: readonly Member[];
}) {
  return (
    <>
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
      <FormSection legend="Split">
        <FormField label="Allocation">
          <select
            className={selectClassName}
            defaultValue="equal"
            name="splitMode"
          >
            <option value="equal">50/50</option>
            <option value="exact">Exact amounts</option>
          </select>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          {members.map((member) => (
            <FormField
              key={member.user_id}
              label={`${member.display_name}'s exact share`}
              description="Used only for an exact split."
            >
              <Input
                inputMode="decimal"
                name={`allocation:${member.user_id}`}
                placeholder="0.00"
              />
            </FormField>
          ))}
        </div>
      </FormSection>
    </>
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
  };
  return (
    <FormFields
      action={action}
      submitLabel={draft ? "Post draft" : "Post expense"}
    >
      <input name="idempotencyKey" type="hidden" value={crypto.randomUUID()} />
      {draft ? <input name="draftId" type="hidden" value={draft.id} /> : null}
      <ExpenseFields
        draft={normalizedDraft}
        members={members}
        viewerId={viewerId}
      />
      <SplitFields categories={categories} members={members} />
    </FormFields>
  );
}
