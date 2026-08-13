"use client";

import { useState } from "react";

import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { AmountField, useAmountValue } from "@/ui/forms/amount-field.client";
import { FormField } from "@/ui/forms/form-field.client";
import { useFormFieldsState } from "@/ui/forms/form-fields.client";
import { selectClassName } from "@/ui/forms/form-page";

type SettlementMode = "full" | "partial";

function toSettlementMode(
  value: string | undefined,
  fallback: SettlementMode,
): SettlementMode {
  if (value === "partial") return "partial";
  if (value === "full") return "full";
  return fallback;
}

/**
 * A full settlement always transfers the whole outstanding balance, so the
 * amount is not merely ignored — it is not offered.
 */
export function SettlementFields({
  initialMode,
  outstandingCents,
}: {
  initialMode: SettlementMode;
  outstandingCents: number;
}) {
  const { values } = useFormFieldsState();
  const [mode, setMode] = useState<SettlementMode>(
    toSettlementMode(values.mode, initialMode),
  );
  const [amount, setAmount] = useAmountValue("amount");
  const outstanding = formatCentimesAsFrancs(outstandingCents);

  return (
    <>
      <FormField label="How much was paid">
        {/* Controlled: an uncontrolled select can revert to full while the
            partial amount field is still on screen. */}
        <select
          className={selectClassName}
          name="mode"
          onChange={(event) =>
            setMode(toSettlementMode(event.target.value, mode))
          }
          value={mode}
        >
          <option value="full">{`Full current balance — ${outstanding}`}</option>
          <option value="partial">Part of the balance</option>
        </select>
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
