import { z } from "zod";

import type { AllocationValidationError } from "@/domain/money/allocations";
import {
  allocateEqualExpense,
  validateExactAllocations,
} from "@/domain/money/allocations";
import { chfAmountMessage, parseChfToCentimes } from "@/domain/money/chf";
import { asMemberId } from "@/domain/money/values";
import { FormFieldError } from "@/lib/forms/field-error";
import type { MoneyAllocationInput } from "@/lib/money/commands";
import { proposedAllocationSchema } from "@/lib/read-models/expense-draft-readiness";

const uuidSchema = z.string().uuid("Choose a valid household option.");
const dateSchema = z.iso.date("Choose a valid date.");

function optionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function requiredString(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string") {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function optionalUuid(formData: FormData, name: string): string | null {
  const value = optionalText(formData.get(name));
  return value === null ? null : uuidSchema.parse(value);
}

export function parseChfField(formData: FormData, name: string): number {
  const raw = formData.get(name);
  const value = typeof raw === "string" ? raw.trim() : "";
  try {
    return parseChfToCentimes(value);
  } catch (error) {
    throw new FormFieldError(
      name,
      error instanceof Error ? error.message : chfAmountMessage,
    );
  }
}

export function draftSplitDefaults(
  amountCents: number | null,
  payerMemberId: string | null,
  memberIds: readonly [string, string],
  proposedAllocations: unknown,
): {
  mode: "equal" | "exact";
  allocationsByMemberId: Readonly<Record<string, number>>;
} {
  const parsed = z
    .array(proposedAllocationSchema)
    .safeParse(proposedAllocations);
  const allocationsByMemberId: Record<string, number> = {};
  if (parsed.success) {
    for (const row of parsed.data) {
      allocationsByMemberId[row.memberId] = row.allocatedCents;
    }
  }
  if (
    amountCents === null ||
    payerMemberId === null ||
    !parsed.success ||
    parsed.data.length === 0
  ) {
    return { mode: "equal", allocationsByMemberId };
  }
  const otherMemberId = memberIds.find((id) => id !== payerMemberId);
  if (otherMemberId === undefined) {
    return { mode: "equal", allocationsByMemberId };
  }
  const equal = allocateEqualExpense(
    amountCents,
    asMemberId(payerMemberId),
    asMemberId(otherMemberId),
  );
  const matchesEqual = equal.every(
    (share) => allocationsByMemberId[share.memberId] === share.allocatedCents,
  );
  return {
    mode: matchesEqual ? "equal" : "exact",
    allocationsByMemberId,
  };
}

export type ExpenseFormValue = {
  description: string;
  amountCents: number;
  payerMemberId: string;
  allocations: readonly MoneyAllocationInput[];
  occurredOn: string;
  categoryId: string | null;
  note: string | null;
  idempotencyKey: string;
};

const exactSplitMessages: Readonly<
  Record<AllocationValidationError["code"], string>
> = {
  invalid_amount: "Enter an amount greater than CHF 0.00.",
  same_member: "An expense needs two different people to share it.",
  exact_members_required: "Each of you needs exactly one share.",
  duplicate_member: "Each of you needs exactly one share.",
  invalid_allocation: "Each share has to be CHF 0.00 or more.",
  allocation_sum_mismatch: "The two shares need to add up to the total.",
};

function exactSplitError(
  error: AllocationValidationError,
  shareField: string,
): FormFieldError {
  return new FormFieldError(
    error.code === "invalid_amount" ? "amount" : shareField,
    exactSplitMessages[error.code],
  );
}

export function parseExpenseForm(
  formData: FormData,
  memberIds: readonly [string, string],
): ExpenseFormValue {
  const amountCents = parseChfField(formData, "amount");
  if (amountCents <= 0) {
    throw new FormFieldError(
      "amount",
      "Enter an amount greater than CHF 0.00.",
    );
  }
  const payerMemberId = uuidSchema.parse(
    requiredString(formData, "payerMemberId"),
  );
  if (!memberIds.includes(payerMemberId)) {
    throw new Error("Choose a household member as payer.");
  }
  const otherMemberId = memberIds.find((id) => id !== payerMemberId);
  if (otherMemberId === undefined) {
    throw new Error("Expenses require two members.");
  }
  const splitMode = z
    .enum(["equal", "exact"])
    .parse(requiredString(formData, "splitMode"));
  let allocations: readonly MoneyAllocationInput[];
  if (splitMode === "equal") {
    allocations = allocateEqualExpense(
      amountCents,
      asMemberId(payerMemberId),
      asMemberId(otherMemberId),
    );
  } else {
    const proposed = memberIds.map((memberId) => ({
      memberId: asMemberId(memberId),
      allocatedCents: parseChfField(formData, `allocation:${memberId}`),
    }));
    const validated = validateExactAllocations(
      amountCents,
      asMemberId(payerMemberId),
      asMemberId(otherMemberId),
      proposed,
    );
    if (!validated.ok) {
      throw exactSplitError(validated.error, `allocation:${memberIds[0]}`);
    }
    allocations = validated.allocations;
  }
  return {
    description: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .parse(requiredString(formData, "description")),
    amountCents,
    payerMemberId,
    allocations,
    occurredOn: dateSchema.parse(requiredString(formData, "occurredOn")),
    categoryId: optionalUuid(formData, "categoryId"),
    note: z
      .string()
      .max(4000)
      .nullable()
      .parse(optionalText(formData.get("note"))),
    idempotencyKey: uuidSchema.parse(
      requiredString(formData, "idempotencyKey"),
    ),
  };
}

export function parseOpeningBalanceForm(formData: FormData) {
  const amountCents = parseChfField(formData, "amount");
  if (amountCents <= 0) {
    throw new FormFieldError(
      "amount",
      "Enter an amount greater than CHF 0.00.",
    );
  }
  return {
    creditorMemberId: uuidSchema.parse(
      requiredString(formData, "creditorMemberId"),
    ),
    amountCents,
    occurredOn: dateSchema.parse(requiredString(formData, "occurredOn")),
    note: z
      .string()
      .max(4000)
      .nullable()
      .parse(optionalText(formData.get("note"))),
    idempotencyKey: uuidSchema.parse(
      requiredString(formData, "idempotencyKey"),
    ),
  };
}

export function parseSettlementForm(formData: FormData) {
  const mode = z
    .enum(["full", "partial"])
    .parse(requiredString(formData, "mode"));
  const amountCents =
    mode === "full" ? null : parseChfField(formData, "amount");
  if (amountCents !== null && amountCents <= 0) {
    throw new FormFieldError(
      "amount",
      "Enter an amount greater than CHF 0.00.",
    );
  }
  return {
    mode,
    amountCents,
    occurredOn: dateSchema.parse(requiredString(formData, "occurredOn")),
    note: z
      .string()
      .max(4000)
      .nullable()
      .parse(optionalText(formData.get("note"))),
    idempotencyKey: uuidSchema.parse(
      requiredString(formData, "idempotencyKey"),
    ),
  };
}
