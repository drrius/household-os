"use client";
import { useState } from "react";
import type { FormAction } from "@/lib/forms/action-state";
import { AttachmentField } from "@/ui/attachments/attachment-field.client";
import { EchoedTextarea } from "@/ui/forms/echoed-control.client";
import { ExpenseAmountAndSplitFields } from "@/ui/forms/expense-split-fields.client";
import { FormFields, useFormFieldValue } from "@/ui/forms/form-fields.client";
import { FormField } from "@/ui/forms/form-field.client";
import { EchoedSelect } from "@/ui/forms/form-select.client";
function ContextReceipt() {
  const path = useFormFieldValue("receiptPath");
  return (
    <AttachmentField
      name="receiptPath"
      label="Receipt"
      purpose="receipts"
      initialPath={path}
    />
  );
}
export function ContextExpenseForm({
  action,
  initialKey,
  members,
  categories,
  occurredOn,
  viewerId,
}: {
  action: FormAction;
  initialKey: string;
  members: readonly { user_id: string; display_name: string }[];
  categories: readonly { id: string; name: string }[];
  occurredOn: string;
  viewerId: string;
}) {
  const [snapshot] = useState({ initialKey, occurredOn, viewerId });
  return (
    <FormFields protectChanges action={action} submitLabel="Post expense">
      <input type="hidden" name="idempotencyKey" value={snapshot.initialKey} />
      <ExpenseAmountAndSplitFields
        initialAmount=""
        initialDescription=""
        initialExactCents={{}}
        initialMode="equal"
        initialPayerMemberId={snapshot.viewerId}
        isDraft={false}
        members={members}
        occurredOn={snapshot.occurredOn}
      />
      <FormField label="Category" optional>
        <EchoedSelect
          name="categoryId"
          items={[
            { label: "Other", value: "" },
            ...categories.map((value) => ({
              label: value.name,
              value: value.id,
            })),
          ]}
        />
      </FormField>
      <FormField label="Note" optional>
        <EchoedTextarea name="note" maxLength={4000} />
      </FormField>
      <ContextReceipt />
    </FormFields>
  );
}
