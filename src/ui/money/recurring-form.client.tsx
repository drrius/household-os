"use client";
import { useState } from "react";
import { saveRecurringRuleAction } from "@/app/(product)/money/recurring-actions";
import type { FormAction } from "@/lib/forms/action-state";
import { draftSplitDefaults } from "@/lib/forms/money";
import type { MoneyRecurringRule } from "@/lib/read-models/money-recurring";
import { formatCentimesField } from "@/domain/money/chf";
import { ExpenseAmountAndSplitFields } from "@/ui/forms/expense-split-fields.client";
import { FormField, FormFields, FormSection } from "@/ui/forms/form-page";
import { EchoedSelect } from "@/ui/forms/form-select.client";
import { RecurringScheduleFields } from "@/ui/money/recurring-schedule.client";

type Member = { user_id: string; display_name: string };
export type RecurringFormProps = {
  rule: MoneyRecurringRule | null;
  members: readonly Member[];
  categories: readonly { id: string; name: string }[];
  today: string;
  viewerId: string;
  action?: FormAction;
};
export function RecurringFormClient(
  props: RecurringFormProps & { idempotencyKey: string },
) {
  return <RecurringFormSession key={props.rule?.id ?? "new"} {...props} />;
}
function RecurringFormSession({
  rule: initialRule,
  today: initialToday,
  idempotencyKey: initialKey,
  members,
  categories,
  viewerId,
  action = saveRecurringRuleAction,
}: RecurringFormProps & { idempotencyKey: string }) {
  const [{ rule, today, idempotencyKey }] = useState({
    rule: initialRule,
    today: initialToday,
    idempotencyKey: initialKey,
  });
  const split =
    members[0] && members[1]
      ? draftSplitDefaults(
          rule?.amount_cents ?? null,
          rule?.payer_member_id ?? null,
          [members[0].user_id, members[1].user_id],
          rule?.proposed_allocations ?? [],
        )
      : { mode: "equal" as const, allocationsByMemberId: {} };
  return (
    <FormFields
      protectChanges
      action={action}
      submitLabel={rule ? "Save recurring expense" : "Create recurring expense"}
    >
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      {rule ? (
        <>
          <input name="ruleId" type="hidden" value={rule.id} />
          <input
            name="expectedUpdatedAt"
            type="hidden"
            value={rule.updated_at}
          />
        </>
      ) : null}
      <p className="mb-6 text-sm text-muted-foreground">
        The date below is the next draft date. You review each draft before it
        affects your balance.
      </p>
      <ExpenseAmountAndSplitFields
        initialAmount={rule ? formatCentimesField(rule.amount_cents) : ""}
        initialDescription={rule?.description ?? ""}
        initialExactCents={split.allocationsByMemberId}
        initialMode={split.mode}
        initialPayerMemberId={rule?.payer_member_id ?? viewerId}
        isDraft={false}
        members={members}
        occurredOn={rule?.next_occurrence_on ?? today}
      />
      <FormSection legend="Repeats">
        <RecurringScheduleFields rule={rule} today={today} />
        <FormField label="Category" optional>
          <EchoedSelect
            name="categoryId"
            initialValue={rule?.category_id ?? ""}
            items={[
              { label: "Other", value: "" },
              ...categories.map((category) => ({
                label: category.name,
                value: category.id,
              })),
            ]}
          />
        </FormField>
        <p className="text-sm text-muted-foreground">
          Edits affect future drafts. Drafts already waiting for review keep
          their original details.
        </p>
      </FormSection>
    </FormFields>
  );
}
