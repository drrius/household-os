"use client";

import { useState, type ReactNode } from "react";

import { parseChfToCentimesOrNull } from "@/domain/money/chf";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { AmountField, useAmountValue } from "@/ui/forms/amount-field.client";
import { DateField } from "@/ui/forms/date-field.client";
import { FormField } from "@/ui/forms/form-field.client";
import { useFormFieldValue } from "@/ui/forms/form-fields.client";
import { FormSelect } from "@/ui/forms/form-select.client";
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

export function OpeningBalanceSummary({
  defaultDate,
  members,
  defaultCreditorId,
  defaultAmount = "",
}: {
  defaultDate: string;
  defaultCreditorId?: string;
  defaultAmount?: string;
  members: readonly Member[];
}) {
  const [creditorId, setCreditorId] = useState(
    useFormFieldValue(
      "creditorMemberId",
      defaultCreditorId ?? members[0]?.id ?? "",
    ),
  );
  const [amount, setAmount] = useAmountValue("amount", defaultAmount);
  const creditor = members.find((member) => member.id === creditorId);
  const debtor = members.find((member) => member.id !== creditorId);

  return (
    <>
      <FormField label="Member who is owed">
        <FormSelect
          items={members.map((member) => ({
            label: member.displayName,
            value: member.id,
          }))}
          name="creditorMemberId"
          onValueChange={setCreditorId}
          value={creditorId}
        />
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
