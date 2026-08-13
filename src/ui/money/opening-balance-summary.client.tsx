"use client";

import { useState, type ReactNode } from "react";

import { parseChfToCentimesOrNull } from "@/domain/money/chf";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { AmountField, useAmountValue } from "@/ui/forms/amount-field.client";
import { DateField } from "@/ui/forms/date-field.client";
import { FormField } from "@/ui/forms/form-field.client";
import { useFormFieldsState } from "@/ui/forms/form-fields.client";
import { selectClassName } from "@/ui/forms/form-page";
import { Amount } from "@/ui/layout/amount";

type Member = { displayName: string; id: string };

function summary(
  amount: string,
  creditor: Member | undefined,
  debtor: Member | undefined,
): ReactNode {
  const centimes = parseChfToCentimesOrNull(amount);
  if (centimes === null || centimes <= 0 || !creditor || !debtor) {
    return "Enter an amount to see who will owe whom.";
  }
  return (
    <>
      {debtor.displayName} will owe {creditor.displayName}{" "}
      <Amount value={formatCentimesAsFrancs(centimes)} />.
    </>
  );
}

/**
 * The direction of an opening balance is easy to reverse by accident and the
 * event it writes cannot be edited afterwards, so the consequence is restated
 * in full before it is posted.
 */
export function OpeningBalanceSummary({
  defaultDate,
  members,
}: {
  defaultDate: string;
  members: readonly Member[];
}) {
  const { values } = useFormFieldsState();
  const [creditorId, setCreditorId] = useState(
    values.creditorMemberId ?? members[0]?.id ?? "",
  );
  const [amount, setAmount] = useAmountValue("amount");
  const creditor = members.find((member) => member.id === creditorId);
  const debtor = members.find((member) => member.id !== creditorId);

  return (
    <>
      <FormField label="Member who is owed">
        <select
          className={selectClassName}
          name="creditorMemberId"
          onChange={(event) => setCreditorId(event.target.value)}
          value={creditorId}
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </select>
      </FormField>
      <AmountField
        label="Amount in CHF"
        name="amount"
        onValueChange={setAmount}
        required
        value={amount}
      />
      <DateField
        defaultValue={defaultDate}
        label="As of"
        name="occurredOn"
        required
      />
      <p aria-live="polite" className="text-sm font-normal">
        {summary(amount, creditor, debtor)}
      </p>
    </>
  );
}
