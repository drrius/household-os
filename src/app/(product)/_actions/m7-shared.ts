import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMemberContext } from "@/lib/auth/member-context";
import { formErrorMessage } from "@/lib/forms/m7";
import { createClient } from "@/lib/supabase/server";

export const uuidSchema = z.string().uuid();
export const namedMemberSchema = z.object({
  user_id: z.string().uuid(),
  display_name: z.string().trim().min(1),
});

export function errorHref(path: string, error: unknown): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}error=${encodeURIComponent(formErrorMessage(error))}`;
}

export function revalidateProduct(paths: readonly string[]): void {
  for (const path of paths) revalidatePath(path);
}

export async function loadHouseholdMembers(): Promise<
  readonly [
    z.infer<typeof namedMemberSchema>,
    z.infer<typeof namedMemberSchema>,
  ]
> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("user_id, display_name")
    .eq("household_id", member.householdId)
    .order("joined_at")
    .order("user_id");
  if (error) throw new Error(`household_members failed: ${error.message}`);
  const rows = z.array(namedMemberSchema).parse(data);
  if (rows.length !== 2 || rows[0] === undefined || rows[1] === undefined) {
    throw new Error("This household needs exactly two members.");
  }
  return [rows[0], rows[1]];
}
