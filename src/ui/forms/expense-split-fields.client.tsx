"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  formatCentimesField,
  reconcileShares,
  sharesBalance,
  type ShareReconciliation,
} from "@/domain/money/chf";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { AmountField, useAmountValue } from "@/ui/forms/amount-field.client";
import { DateField } from "@/ui/forms/date-field.client";
import { FormField } from "@/ui/forms/form-field.client";
import { useFormFieldsState } from "@/ui/forms/form-fields.client";
import { FormSection, selectClassName } from "@/ui/forms/form-page";

type Member = { user_id: string; display_name: string };
type SplitMode = "equal" | "exact";
type Shares = Readonly<Record<string, string>>;

function toSplitMode(
  value: string | undefined,
  fallback: SplitMode,
): SplitMode {
  if (value === "exact") return "exact";
  if (value === "equal") return "equal";
  return fallback;
}

function splitStatus(reconciliation: ShareReconciliation | null): string {
  if (reconciliation === null) {
    return "Enter the total and both shares to see whether they add up.";
  }
  const { amountCents, differenceCents, sharesCents } = reconciliation;
  const total = formatCentimesAsFrancs(amountCents);
  if (reconciliation.filledShareCount < reconciliation.shareCount) {
    return `Shares so far ${formatCentimesAsFrancs(sharesCents)} of ${total}.`;
  }
  if (differenceCents === 0) return `Shares add up to ${total}.`;
  const gap = formatCentimesAsFrancs(Math.abs(differenceCents));
  const direction =
    differenceCents < 0 ? `${gap} short of` : `${gap} more than`;
  return `Shares total ${formatCentimesAsFrancs(sharesCents)} — ${direction} ${total}.`;
}

/**
 * Set on the first share so the browser blocks the submit and `FormFields`
 * keeps the sentence under the field; undefined while a share is still empty,
 * where `required` is the better message.
 */
function unbalancedShares(
  members: readonly Member[],
  reconciliation: ShareReconciliation | null,
): string | undefined {
  if (
    reconciliation === null ||
    reconciliation.filledShareCount < reconciliation.shareCount ||
    sharesBalance(reconciliation)
  ) {
    return undefined;
  }
  const names = members.map((member) => member.display_name).join(" and ");
  return `${names} add up to ${formatCentimesAsFrancs(reconciliation.sharesCents)}. They need to add up to ${formatCentimesAsFrancs(reconciliation.amountCents)}.`;
}

function SplitSection({
  members,
  mode,
  onModeChange,
  onShareChange,
  reconciliation,
  shares,
}: {
  members: readonly Member[];
  mode: SplitMode;
  onModeChange: (mode: SplitMode) => void;
  onShareChange: (memberId: string, value: string) => void;
  reconciliation: ShareReconciliation | null;
  shares: Shares;
}) {
  const statusId = useId();
  const blocking = unbalancedShares(members, reconciliation);
  return (
    <FormSection legend="Split">
      <FormField label="How to split it">
        {/* Controlled: an uncontrolled select silently reverts to 50/50 after a
            rejected submit while the exact fields stay on screen. */}
        <select
          className={selectClassName}
          name="splitMode"
          onChange={(event) =>
            onModeChange(toSplitMode(event.target.value, mode))
          }
          value={mode}
        >
          <option value="equal">Split evenly</option>
          <option value="exact">Different amounts each</option>
        </select>
      </FormField>
      {mode === "exact" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {members.map((member, index) => (
              <AmountField
                customValidity={index === 0 ? blocking : undefined}
                describedById={statusId}
                invalid={blocking === undefined ? undefined : true}
                key={member.user_id}
                label={`${member.display_name} pays`}
                name={`allocation:${member.user_id}`}
                onValueChange={(value) => onShareChange(member.user_id, value)}
                required
                value={shares[member.user_id] ?? ""}
              />
            ))}
          </div>
          <p
            aria-live="polite"
            className={
              blocking === undefined
                ? "text-sm font-normal text-muted-foreground"
                : "text-sm font-normal text-destructive-strong"
            }
            id={statusId}
          >
            {splitStatus(reconciliation)}
          </p>
        </>
      ) : null}
    </FormSection>
  );
}

function ExpenseSection({
  amount,
  initialDescription,
  initialPayerMemberId,
  isDraft,
  members,
  occurredOn,
  onAmountChange,
}: {
  amount: string;
  initialDescription: string;
  initialPayerMemberId: string;
  isDraft: boolean;
  members: readonly Member[];
  occurredOn: string;
  onAmountChange: (value: string) => void;
}) {
  return (
    <FormSection legend="Expense">
      <FormField label="Description">
        <Input
          defaultValue={initialDescription}
          maxLength={200}
          name="description"
          readOnly={isDraft}
          required
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <AmountField
          label="Amount in CHF"
          name="amount"
          onValueChange={onAmountChange}
          required
          value={amount}
        />
        <DateField
          defaultValue={occurredOn}
          label="Date"
          name="occurredOn"
          required
        />
      </div>
      <FormField label="Payer">
        <select
          className={selectClassName}
          defaultValue={initialPayerMemberId}
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

/**
 * The amount lives in this client boundary with the shares: an exact split can
 * only be reconciled while both are in one place, and the check has to happen
 * before an append-only event is posted.
 */
export function ExpenseAmountAndSplitFields({
  initialAmount,
  initialDescription,
  initialExactCents,
  initialMode,
  initialPayerMemberId,
  isDraft,
  members,
  occurredOn,
}: {
  initialAmount: string;
  initialDescription: string;
  initialExactCents: Readonly<Record<string, number>>;
  initialMode: SplitMode;
  initialPayerMemberId: string;
  isDraft: boolean;
  members: readonly Member[];
  occurredOn: string;
}) {
  const { values } = useFormFieldsState();
  const [amount, setAmount] = useAmountValue("amount", initialAmount);
  const [mode, setMode] = useState<SplitMode>(
    toSplitMode(values.splitMode, initialMode),
  );
  const [shares, setShares] = useState<Shares>(() =>
    Object.fromEntries(
      members.map((member) => {
        const stored = initialExactCents[member.user_id];
        return [
          member.user_id,
          values[`allocation:${member.user_id}`] ??
            (stored === undefined ? "" : formatCentimesField(stored)),
        ];
      }),
    ),
  );
  const reconciliation =
    mode === "exact"
      ? reconcileShares(
          amount,
          members.map((member) => shares[member.user_id] ?? ""),
        )
      : null;

  return (
    <>
      <ExpenseSection
        amount={amount}
        initialDescription={initialDescription}
        initialPayerMemberId={initialPayerMemberId}
        isDraft={isDraft}
        members={members}
        occurredOn={occurredOn}
        onAmountChange={setAmount}
      />
      <SplitSection
        members={members}
        mode={mode}
        onModeChange={setMode}
        onShareChange={(memberId, value) =>
          setShares((current) => ({ ...current, [memberId]: value }))
        }
        reconciliation={reconciliation}
        shares={shares}
      />
    </>
  );
}
