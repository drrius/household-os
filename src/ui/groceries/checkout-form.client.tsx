"use client";

import { useState } from "react";
import { AttachmentField } from "@/ui/attachments/attachment-field.client";
import type { FormAction } from "@/lib/forms/action-state";
import { AmountField, useAmountValue } from "@/ui/forms/amount-field.client";
import { DateField } from "@/ui/forms/date-field.client";
import { ExpenseAmountAndSplitFields } from "@/ui/forms/expense-split-fields.client";
import { FormFields, useFormFieldValue } from "@/ui/forms/form-fields.client";

type Props = {
  action: FormAction;
  sessionId: string;
  members: readonly { user_id: string; display_name: string }[];
  viewerId: string;
  occurredOn: string;
  idempotencyKey: string;
};

function CheckoutFields({
  sessionId,
  members,
  viewerId,
  occurredOn,
  idempotencyKey,
}: Omit<Props, "action">) {
  const receiptPath = useFormFieldValue("receiptPath");
  const [receiptTotal, setReceiptTotal] = useAmountValue("receiptTotal");
  const [withExpense, setWithExpense] = useState(
    useFormFieldValue("createExpenseDraft") === "on",
  );
  return (
    <>
      <input name="sessionId" type="hidden" value={sessionId} />
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <AmountField
        label="Receipt total in CHF"
        name="receiptTotal"
        optional
        onValueChange={setReceiptTotal}
        value={receiptTotal}
      />
      <p className="text-sm text-muted-foreground">
        Optional. This can include personal purchases.
      </p>
      <AttachmentField
        initialPath={receiptPath}
        label="Receipt photo or PDF"
        name="receiptPath"
        purpose="receipts"
      />
      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-4">
        <input
          checked={withExpense}
          className="size-5 accent-primary"
          name="createExpenseDraft"
          onChange={(event) => setWithExpense(event.target.checked)}
          type="checkbox"
        />
        <span className="font-semibold">Create a shared expense draft</span>
      </label>
      {withExpense ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Enter only the amount you&apos;re sharing. You&apos;ll review the
            draft in Money before it changes who owes whom.
          </p>
          <ExpenseAmountAndSplitFields
            initialAmount=""
            initialDescription="Groceries"
            initialExactCents={{}}
            initialMode="equal"
            initialPayerMemberId={viewerId}
            isDraft={false}
            members={members}
            occurredOn={occurredOn}
          />
        </div>
      ) : (
        <DateField
          defaultValue={occurredOn}
          label="Shopping date"
          name="occurredOn"
          required
        />
      )}
    </>
  );
}

export function CheckoutForm({ action, ...props }: Props) {
  return (
    <FormFields protectChanges action={action} submitLabel="Finish shopping">
      <CheckoutFields {...props} />
    </FormFields>
  );
}
