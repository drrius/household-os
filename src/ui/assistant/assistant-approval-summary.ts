import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { formatCivilDateShort } from "@/lib/ui/zurich-date";

/** One line of an approval summary, rendered as a term/detail pair. */
export type SummaryRow = {
  readonly label: string;
  readonly value: string;
  /** Opens the group describing what will be recorded, after a reversal. */
  readonly startsGroup?: boolean;
};

export type MemberNamer = (id: unknown) => string | null;

function formatChf(cents: unknown): string | null {
  if (typeof cents !== "number" || !Number.isSafeInteger(cents)) {
    return null;
  }
  // Integer francs + two-digit remainder; centimes never touch floats.
  return formatCentimesAsFrancs(cents);
}

function splitRow(split: unknown, nameOf: MemberNamer): SummaryRow | null {
  if (split === null || typeof split !== "object" || !("kind" in split)) {
    return null;
  }
  const value = split as { kind?: unknown; allocations?: unknown };
  if (value.kind === "equal") {
    return { label: "Split", value: "Equally" };
  }
  if (value.kind !== "custom" || !Array.isArray(value.allocations)) {
    return null;
  }
  const shares = value.allocations.map((entry) => {
    const allocation = entry as {
      memberId?: unknown;
      allocatedCents?: unknown;
    };
    const amount = formatChf(allocation.allocatedCents) ?? "?";
    const name = nameOf(allocation.memberId);
    return name === null ? amount : `${name} ${amount}`;
  });
  return shares.length > 0
    ? { label: "Split", value: shares.join(" · ") }
    : null;
}

function eventRows(input: unknown, nameOf: MemberNamer): readonly SummaryRow[] {
  if (input === null || typeof input !== "object") {
    return [];
  }
  const value = input as Record<string, unknown>;
  const rows: SummaryRow[] = [];
  if (typeof value.description === "string") {
    rows.push({ label: "What", value: value.description });
  }
  const amount = formatChf(value.amountCents);
  if (amount !== null) {
    rows.push({ label: "Amount", value: amount });
  }
  if (
    typeof value.relatedEventId === "string" &&
    typeof value.originalDescription === "string"
  ) {
    rows.push({ label: "Refunds", value: value.originalDescription });
  }
  const payer = nameOf(value.payerMemberId);
  if (payer !== null) {
    rows.push({ label: "Paid by", value: payer });
  }
  const creditor = nameOf(value.creditorMemberId);
  if (creditor !== null) {
    rows.push({ label: "Owed to", value: creditor });
  }
  const split = splitRow(value.split, nameOf);
  if (split !== null) {
    rows.push(split);
  }
  if (typeof value.occurredOn === "string") {
    rows.push({ label: "Date", value: formatCivilDateShort(value.occurredOn) });
  }
  return rows;
}

/**
 * A correction's financial effect lives in the nested replacement, not the
 * top-level input; surface it so the member can verify before approving.
 */
function correctionRows(
  input: unknown,
  nameOf: MemberNamer,
): readonly SummaryRow[] {
  if (
    input === null ||
    typeof input !== "object" ||
    !("replacement" in input)
  ) {
    return [];
  }
  const value = input as Record<string, unknown>;
  const amount = formatChf(value.originalAmountCents);
  const original =
    typeof value.originalDescription === "string"
      ? `${value.originalDescription}${amount === null ? "" : ` (${amount})`}`
      : "The original event";
  const reverses: SummaryRow = { label: "Reverses", value: original };
  const replacement = value.replacement;
  if (replacement === null || replacement === undefined) {
    return [reverses, { label: "Replaced by", value: "Nothing" }];
  }
  const [first, ...rest] = eventRows(replacement, nameOf);
  if (first === undefined) {
    return [reverses];
  }
  return [reverses, { ...first, startsGroup: true }, ...rest];
}

/** Everything a member needs to check before approving a tool call. */
export function approvalRows(
  input: unknown,
  nameOf: MemberNamer,
): readonly SummaryRow[] {
  return [...eventRows(input, nameOf), ...correctionRows(input, nameOf)];
}
