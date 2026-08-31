import "server-only";

import { z } from "zod";

import { allocateEqualExpense } from "@/domain/money/allocations";
import { asMemberId } from "@/domain/money/values";
import { expenseSplitSchema } from "@/lib/ai/definitions";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import type { MoneyAllocationInput } from "@/lib/money/commands";

export type ExpenseSplit = z.infer<typeof expenseSplitSchema>;

export async function resolveAllocations(
  split: ExpenseSplit,
  amountCents: number,
  payerMemberId: string,
): Promise<readonly MoneyAllocationInput[]> {
  if (split.kind === "custom") {
    return split.allocations;
  }
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", member.householdId);
  if (error !== null || !Array.isArray(data)) {
    throw new Error(`members query failed: ${error?.message ?? "no data"}`);
  }
  const other = data.find((row) => row.user_id !== payerMemberId);
  if (other === undefined) {
    throw new Error("Equal split needs a second household member");
  }
  return allocateEqualExpense(
    amountCents,
    asMemberId(payerMemberId),
    asMemberId(other.user_id),
  );
}
