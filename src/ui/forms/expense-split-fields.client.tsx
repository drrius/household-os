"use client";

import { EqualSplitPreview } from "@/ui/money/equal-split-preview";
import { useId, useState } from "react";

import { EchoedInput } from "@/ui/forms/echoed-control.client";
import {
  formatCentimesField,
  parseChfToCentimesOrNull,
} from "@/domain/money/chf";
import {
  exactSharesBalance,
  reconcileShares,
  type ShareReconciliation,
} from "@/lib/forms/shares";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { AmountField, useAmountValue } from "@/ui/forms/amount-field.client";
import { DateField } from "@/ui/forms/date-field.client";
import { FormField } from "@/ui/forms/form-field.client";
import {
  useFormFieldValue,
  useFormFieldsState,
} from "@/ui/forms/form-fields.client";
import { FormSection } from "@/ui/forms/form-page";
import { FormSelect } from "@/ui/forms/form-select.client";

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

function unbalancedShares(
  members: readonly Member[],
  payerMemberId: string,
  reconciliation: ShareReconciliation | null,
  shares: Shares,
): string | undefined {
  if (
    reconciliation === null ||
    reconciliation.filledShareCount < reconciliation.shareCount
  ) {
    return undefined;
  }
  const first = members[0];
  const second = members[1];
  if (first === undefined || second === undefined) return undefined;
  const firstCents = parseChfToCentimesOrNull(shares[first.user_id] ?? "");
  const secondCents = parseChfToCentimesOrNull(shares[second.user_id] ?? "");
  if (firstCents === null || secondCents === null) return undefined;
  if (
    exactSharesBalance({
      amountCents: reconciliation.amountCents,
      memberIds: [first.user_id, second.user_id],
      payerMemberId,
      sharesCents: [firstCents, secondCents],
    })
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
  payerMemberId,
  reconciliation,
  shares,
}: {
  members: readonly Member[];
  mode: SplitMode;
  onModeChange: (mode: SplitMode) => void;
  onShareChange: (memberId: string, value: string) => void;
  payerMemberId: string;
  reconciliation: ShareReconciliation | null;
  shares: Shares;
}) {
  const statusId = useId();
  const blocking = unbalancedShares(
    members,
    payerMemberId,
    reconciliation,
    shares,
  );
  return (
    <FormSection legend="Split">
      <FormField label="How to split it">
        <FormSelect
          items={[
            { label: "Split evenly", value: "equal" },
            { label: "Different amounts each", value: "exact" },
          ]}
          name="splitMode"
          onValueChange={(value) => onModeChange(toSplitMode(value, mode))}
          value={mode}
        />
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
                label={`${member.display_name}'s share`}
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
  onPayerChange,
  payerMemberId,
}: {
  amount: string;
  initialDescription: string;
  initialPayerMemberId: string;
  isDraft: boolean;
  members: readonly Member[];
  occurredOn: string;
  onAmountChange: (value: string) => void;
  onPayerChange: (value: string) => void;
  payerMemberId: string;
}) {
  return (
    <FormSection legend="Expense">
      <FormField label="Description">
        <EchoedInput
          initialValue={initialDescription}
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
        <FormSelect
          items={members.map((member) => ({
            label: member.display_name,
            value: member.user_id,
          }))}
          name="payerMemberId"
          onValueChange={onPayerChange}
          value={payerMemberId || initialPayerMemberId}
        />
      </FormField>
    </FormSection>
  );
}

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
    toSplitMode(useFormFieldValue("splitMode"), initialMode),
  );
  const [payerMemberId, setPayerMemberId] = useState(
    useFormFieldValue("payerMemberId", initialPayerMemberId),
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
        onPayerChange={setPayerMemberId}
        payerMemberId={payerMemberId}
      />
      {mode === "equal" ? (
        <EqualSplitPreview
          amount={amount}
          members={members}
          payerMemberId={payerMemberId}
        />
      ) : null}
      <SplitSection
        members={members}
        mode={mode}
        onModeChange={setMode}
        onShareChange={(memberId, value) =>
          setShares((current) => ({ ...current, [memberId]: value }))
        }
        payerMemberId={payerMemberId}
        reconciliation={reconciliation}
        shares={shares}
      />
    </>
  );
}
