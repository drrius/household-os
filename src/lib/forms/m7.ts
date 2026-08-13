import { z } from "zod";

import {
  allocateEqualExpense,
  validateExactAllocations,
} from "@/domain/money/allocations";
import type { MoneyAllocationInput } from "@/lib/money/commands";
import { asMemberId } from "@/domain/money/values";

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

export function parseChfToCentimes(value: string): number {
  const normalized = value.trim().replace(",", ".");
  const match = /^(\d{1,13})(?:\.(\d{1,2}))?$/.exec(normalized);
  if (match === null) {
    throw new Error("Enter a CHF amount with at most two decimal places.");
  }
  const francs = BigInt(match[1] ?? "0");
  const decimal = (match[2] ?? "").padEnd(2, "0");
  const centimes = francs * 100n + BigInt(decimal || "0");
  if (centimes > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("The CHF amount is too large.");
  }
  return Number(centimes);
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

export { parseRoutineForm, routineFormChangesSchedule } from "./routine";
export type { RoutineFormValue, StoredRoutineSchedule } from "./routine";

const proposedAllocationSchema = z.object({
  memberId: z.string().min(1),
  allocatedCents: z.number().int(),
});

export function expenseFormHref(draftId: string | null): string {
  if (draftId === null || draftId.length === 0) return "/money/expenses/new";
  return `/money/expenses/new?draft=${encodeURIComponent(draftId)}`;
}

export function formatCentimesField(centimes: number): string {
  const absolute = Math.abs(centimes);
  return `${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
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

export type MealFormValue = {
  title: string;
  date: string;
  slot: "breakfast" | "lunch" | "dinner";
  recipeUrl: string | null;
  notes: string | null;
  saveToLibrary: boolean;
  idempotencyKey: string;
};

export function parseMealForm(formData: FormData): MealFormValue {
  const recipeUrl = optionalText(formData.get("recipeUrl"));
  if (recipeUrl !== null) {
    const parsed = new URL(recipeUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Recipe links must use http or https.");
    }
  }
  return {
    title: shortTextSchema.parse(requiredString(formData, "title")),
    date: dateSchema.parse(requiredString(formData, "date")),
    slot: z
      .enum(["breakfast", "lunch", "dinner"])
      .parse(requiredString(formData, "slot")),
    recipeUrl,
    notes: optionalText(formData.get("notes")),
    saveToLibrary: formData.get("saveToLibrary") === "on",
    idempotencyKey: uuidSchema.parse(
      requiredString(formData, "idempotencyKey"),
    ),
  };
}

export type PlaceFromLibraryFormValue = {
  libraryId: string;
  date: string;
  slot: "breakfast" | "lunch" | "dinner";
  notes: string | null;
  idempotencyKey: string;
};

export function parsePlaceFromLibraryForm(
  formData: FormData,
): PlaceFromLibraryFormValue {
  return {
    libraryId: uuidSchema.parse(requiredString(formData, "libraryId")),
    date: dateSchema.parse(requiredString(formData, "date")),
    slot: z
      .enum(["breakfast", "lunch", "dinner"])
      .parse(requiredString(formData, "slot")),
    notes: optionalText(formData.get("notes")),
    idempotencyKey: uuidSchema.parse(
      requiredString(formData, "idempotencyKey"),
    ),
  };
}

export type RemoveMealFormValue = {
  entryId: string;
  idempotencyKey: string;
};

export function parseRemoveMealForm(formData: FormData): RemoveMealFormValue {
  return {
    entryId: uuidSchema.parse(requiredString(formData, "entryId")),
    idempotencyKey: uuidSchema.parse(
      requiredString(formData, "idempotencyKey"),
    ),
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

export function parseExpenseForm(
  formData: FormData,
  memberIds: readonly [string, string],
): ExpenseFormValue {
  const amountCents = parseChfToCentimes(requiredString(formData, "amount"));
  if (amountCents <= 0)
    throw new Error("Expense amount must be greater than zero.");
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
      allocatedCents: parseChfToCentimes(
        requiredString(formData, `allocation:${memberId}`),
      ),
    }));
    const validated = validateExactAllocations(
      amountCents,
      asMemberId(payerMemberId),
      asMemberId(otherMemberId),
      proposed,
    );
    if (!validated.ok) throw new Error(validated.error.message);
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
  const amountCents = parseChfToCentimes(requiredString(formData, "amount"));
  if (amountCents <= 0)
    throw new Error("Opening balance must be greater than zero.");
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
  const amountCents =
    mode === "full"
      ? null
      : parseChfToCentimes(requiredString(formData, "amount"));
  if (amountCents !== null && amountCents <= 0) {
    throw new Error("Settlement amount must be greater than zero.");
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
