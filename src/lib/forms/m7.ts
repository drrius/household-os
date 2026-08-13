import { z } from "zod";

import type { AllocationValidationError } from "@/domain/money/allocations";
import {
  allocateEqualExpense,
  validateExactAllocations,
} from "@/domain/money/allocations";
import { parseChfToCentimes } from "@/domain/money/chf";
import type { MoneyAllocationInput } from "@/lib/money/commands";
import { asMemberId } from "@/domain/money/values";
import { FormFieldError, errorField } from "@/lib/forms/field-error";
import type { FormActionState } from "@/ui/forms/form-action";

const uuidSchema = z.string().uuid("Choose a valid household option.");
const dateSchema = z.iso.date("Choose a valid date.");
const shortTextSchema = z.string().trim().min(1).max(120);
const optionalText = (value: FormDataEntryValue | null): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

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

/**
 * Field-linked so a rejected amount lands under the control that produced it
 * instead of only above the card.
 */
function parseChfField(formData: FormData, name: string): number {
  const raw = formData.get(name);
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value.length === 0) {
    throw new FormFieldError(
      name,
      "Enter an amount in francs, for example 12.50.",
    );
  }
  try {
    return parseChfToCentimes(value);
  } catch (error) {
    throw new FormFieldError(
      name,
      error instanceof Error
        ? error.message
        : "Enter an amount in francs, for example 12.50.",
    );
  }
}

export function formErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Check the form and try again.";
  }
  if (error instanceof Error && !/failed:/i.test(error.message)) {
    return error.message;
  }
  return "We couldn't save that change. Check the details and try again.";
}

/**
 * The one place a rejected submission is assembled, so no action can forget to
 * move `submissionId` on.
 *
 * The counter has to advance here, on the server. Rejecting the same value
 * twice otherwise produces an identical state object, the alert's effect
 * dependencies never change, and the live region stays silent the second time.
 * Incrementing it in the client instead would mean wrapping the action before
 * `useActionState` sees it, which is what costs the form its server-rendered
 * `<form action>` and with it every pre-hydration submission.
 */
export function formRejection(
  previous: FormActionState,
  failure: unknown,
  values: Readonly<Record<string, string>>,
): FormActionState {
  return {
    error: formErrorMessage(failure),
    field: errorField(failure),
    values,
    submissionId: previous.submissionId + 1,
  };
}

// Re-exported so importers keep one CHF entry point while the rule itself
// stays in the domain, where the browser can reuse it.
export { formatCentimesField, parseChfToCentimes } from "@/domain/money/chf";
export { parseRoutineForm, routineFormChangesSchedule } from "./routine";
export type { RoutineFormValue, StoredRoutineSchedule } from "./routine";
export {
  parseMealForm,
  parsePlaceFromLibraryForm,
  parseRemoveMealForm,
  parseUpdateMealForm,
} from "./meal";
export type {
  MealFormValue,
  PlaceFromLibraryFormValue,
  RemoveMealFormValue,
  UpdateMealFormValue,
} from "./meal";

const proposedAllocationSchema = z.object({
  memberId: z.string().min(1),
  allocatedCents: z.number().int(),
});

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

export type GroceryFormValue = {
  name: string;
  quantity: string | null;
  unit: string | null;
  categoryId: string | null;
  note: string | null;
};

export function parseGroceryForm(formData: FormData): GroceryFormValue {
  return {
    name: shortTextSchema.parse(requiredString(formData, "name")),
    quantity: optionalText(formData.get("quantity")),
    unit: optionalText(formData.get("unit")),
    categoryId: optionalUuid(formData, "categoryId"),
    note: optionalText(formData.get("note")),
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

/**
 * The domain messages name storage concepts ("event", "allocations"), so every
 * rejection code gets the plain sentence its control needs. The domain strings
 * themselves stay untouched: they are tested invariants.
 */
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
  if (amountCents <= 0)
    throw new FormFieldError(
      "amount",
      "Enter an amount greater than CHF 0.00.",
    );
  const payerMemberId = uuidSchema.parse(
    requiredString(formData, "payerMemberId"),
  );
  if (!memberIds.includes(payerMemberId)) {
    throw new Error("Choose a household member as payer.");
  }
  const otherMemberId = memberIds.find((id) => id !== payerMemberId);
  if (otherMemberId === undefined)
    throw new Error("Expenses require two members.");
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
    note: optionalText(formData.get("note")),
    idempotencyKey: uuidSchema.parse(
      requiredString(formData, "idempotencyKey"),
    ),
  };
}

export function parseOpeningBalanceForm(formData: FormData) {
  const amountCents = parseChfField(formData, "amount");
  if (amountCents <= 0)
    throw new FormFieldError(
      "amount",
      "Enter an amount greater than CHF 0.00.",
    );
  return {
    creditorMemberId: uuidSchema.parse(
      requiredString(formData, "creditorMemberId"),
    ),
    amountCents,
    occurredOn: dateSchema.parse(requiredString(formData, "occurredOn")),
    note: optionalText(formData.get("note")),
    idempotencyKey: uuidSchema.parse(
      requiredString(formData, "idempotencyKey"),
    ),
  };
}

export function parseSettlementForm(formData: FormData) {
  const mode = z
    .enum(["full", "partial"])
    .parse(requiredString(formData, "mode"));
  // `amount` is read only on the partial branch: the field is not in the DOM
  // for a full settlement.
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
    note: optionalText(formData.get("note")),
    idempotencyKey: uuidSchema.parse(
      requiredString(formData, "idempotencyKey"),
    ),
  };
}
