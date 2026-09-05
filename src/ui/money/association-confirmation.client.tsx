"use client";
import { useState } from "react";
import type { FormAction } from "@/lib/forms/action-state";
import type { AssociationExpense } from "@/lib/connected/cost-associations";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { FormFields } from "@/ui/forms/form-fields.client";
export function AssociationConfirmation({
  action,
  expense,
  currentTitle,
  destinationTitle,
  revision,
  requestId,
  payerName,
}: {
  action: FormAction;
  expense: AssociationExpense;
  currentTitle: string | null;
  destinationTitle: string | null;
  revision: string | null;
  requestId: string;
  payerName: string;
}) {
  // The confirmation and concurrency token describe the same opened snapshot.
  const [opened] = useState({
    action,
    expense,
    currentTitle,
    destinationTitle,
    revision,
    requestId,
    payerName,
  });
  return (
    <FormFields
      action={opened.action}
      showRequiredNotice={false}
      submitLabel={
        opened.destinationTitle ? "Save association" : "Remove association"
      }
    >
      <input
        type="hidden"
        name="expectedRevision"
        value={opened.revision ?? ""}
      />
      <input type="hidden" name="requestId" value={opened.requestId} />
      <div className="grid gap-3 rounded-xl bg-secondary p-4">
        <h2 className="break-words text-xl font-semibold">
          {opened.expense.description}
        </h2>
        <p>
          {formatCentimesAsFrancs(opened.expense.amount_cents)} ·{" "}
          {opened.expense.occurred_on}
        </p>
        <p>Paid by {opened.payerName}</p>
        <p>
          Current association: {opened.currentTitle ?? "No direct association"}
        </p>
        <p>
          {opened.destinationTitle
            ? `Associate with: ${opened.destinationTitle}`
            : "Remove this direct association."}
        </p>
      </div>
      <p className="text-muted-foreground">
        This changes where the payment appears in household costs. It does not
        change the payment, its split, or who owes whom. Related refunds and
        corrections follow this choice unless they have a separate association.
      </p>
      {opened.expense.type === "replacement" && (
        <p className="text-muted-foreground">
          This is a corrected payment. Without a direct association, it follows
          the original payment’s association. Removing an override restores that
          inherited context.
        </p>
      )}
    </FormFields>
  );
}
