"use client";

import { useState } from "react";

import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { AmountField, useAmountValue } from "@/ui/forms/amount-field.client";
import { FormField } from "@/ui/forms/form-field.client";
import { useFormFieldValue } from "@/ui/forms/form-fields.client";
import { FormSelect } from "@/ui/forms/form-select.client";

type SettlementMode = "full" | "partial";

function toSettlementMode(
  value: string | undefined,
  fallback: SettlementMode,
): SettlementMode {
  if (value === "partial") return "partial";
  if (value === "full") return "full";
  return fallback;
}

export function SettlementFields({
  initialMode,
  outstandingCents,
}: {
  initialMode: SettlementMode;
  outstandingCents: number;
}) {
  const [mode, setMode] = useState<SettlementMode>(
    toSettlementMode(useFormFieldValue("mode"), initialMode),
  );
  const [amount, setAmount] = useAmountValue("amount");
  const outstanding = formatCentimesAsFrancs(outstandingCents);

  return (
    <>
      <FormField label="How much was paid">
        <FormSelect
          items={[
            {
              label: `Full current balance — ${outstanding}`,
              value: "full",
            },
            { label: "Part of the balance", value: "partial" },
          ]}
          name="mode"
          onValueChange={(value) => setMode(toSettlementMode(value, mode))}
          value={mode}
        />
      </FormField>
      {mode === "partial" ? (
        <AmountField
          description={`Between CHF 0.01 and ${outstanding} — the current balance.`}
          label="Amount in CHF"
          maxCents={outstandingCents}
          name="amount"
          onValueChange={setAmount}
          required
          value={amount}
        />
      ) : null}
    </>
  );
}
