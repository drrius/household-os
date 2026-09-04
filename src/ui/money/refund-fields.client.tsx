"use client";

import { useState } from "react";
import {
  allocateProportionalRefund,
  type RefundShare,
} from "@/domain/money/refund-remaining";
import {
  formatCentimesField,
  parseChfToCentimesOrNull,
} from "@/domain/money/chf";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { AmountField, useAmountValue } from "@/ui/forms/amount-field.client";
import { useFormFieldValue } from "@/ui/forms/form-fields.client";
import { FormField, FormSection } from "@/ui/forms/form-page";
import { FormSelect } from "@/ui/forms/form-select.client";

type Props = {
  remaining: readonly RefundShare[];
  members: readonly { user_id: string; display_name: string }[];
};

function previewShares(amount: string, remaining: readonly RefundShare[]) {
  const cents = parseChfToCentimesOrNull(amount);
  try {
    return cents === null ? [] : allocateProportionalRefund(cents, remaining);
  } catch {
    return [];
  }
}

function ExactRefundShare({
  name,
  memberId,
  initialCents,
  maximum,
}: {
  name: string;
  memberId: string;
  initialCents?: number;
  maximum: number;
}) {
  const [value, setValue] = useAmountValue(
    `allocation:${memberId}`,
    initialCents === undefined ? "" : formatCentimesField(initialCents),
  );
  return (
    <AmountField
      label={`${name}'s refund share`}
      name={`allocation:${memberId}`}
      value={value}
      onValueChange={setValue}
      maxCents={maximum}
      required
    />
  );
}

function RefundShares({
  amount,
  mode,
  remaining,
  members,
}: Props & { amount: string; mode: string }) {
  const preview = previewShares(amount, remaining);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {remaining.map((share) => {
        const name =
          members.find((member) => member.user_id === share.memberId)
            ?.display_name ?? "Member";
        const value = preview.find(
          (row) => row.memberId === share.memberId,
        )?.allocatedCents;
        return (
          <div key={share.memberId} className="grid gap-2">
            {mode === "exact" ? (
              <ExactRefundShare
                name={name}
                memberId={share.memberId}
                initialCents={value}
                maximum={share.allocatedCents}
              />
            ) : (
              <>
                <input
                  type="hidden"
                  name={`allocation:${share.memberId}`}
                  value={value === undefined ? "" : formatCentimesField(value)}
                />
                <p className="text-sm font-semibold">
                  {name}:{" "}
                  {value === undefined
                    ? "Enter an amount"
                    : formatCentimesAsFrancs(value)}
                </p>
              </>
            )}
            <p className="text-sm text-muted-foreground">
              Up to {formatCentimesAsFrancs(share.allocatedCents)} remaining
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function RefundFields({ remaining, members }: Props) {
  const max = remaining.reduce(
    (total, share) => total + share.allocatedCents,
    0,
  );
  const [amount, setAmount] = useAmountValue(
    "amount",
    formatCentimesField(max),
  );
  const [mode, setMode] = useState(
    useFormFieldValue("refundSplit", "original"),
  );
  return (
    <FormSection legend="Refund and shares">
      <AmountField
        label="Refund amount in CHF"
        name="amount"
        value={amount}
        onValueChange={setAmount}
        maxCents={max}
        required
      />
      <FormField label="How to allocate the refund">
        <FormSelect
          name="refundSplit"
          value={mode}
          onValueChange={setMode}
          items={[
            {
              label: "In proportion to the remaining shares",
              value: "original",
            },
            { label: "Different amounts each", value: "exact" },
          ]}
        />
      </FormField>
      <RefundShares
        amount={amount}
        mode={mode}
        remaining={remaining}
        members={members}
      />
    </FormSection>
  );
}
