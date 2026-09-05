import "server-only";
import { z } from "zod";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

export async function loadShoppingHistory(sessionId: string) {
  if (!z.string().uuid().safeParse(sessionId).success) return null;
  const member = await requireMemberContext();
  const supabase = await createClient();
  const [sessionResult, links] = await Promise.all([
    supabase
      .from("shopping_sessions")
      .select(
        "id, member_id, finished_at, cancelled_at, receipt_total_cents, receipt_path, draft_expense_id",
      )
      .eq("household_id", member.householdId)
      .eq("id", sessionId)
      .not("finished_at", "is", null)
      .maybeSingle(),
    supabase
      .from("shopping_session_items")
      .select("grocery_item_id")
      .eq("household_id", member.householdId)
      .eq("shopping_session_id", sessionId)
      .not("purchased_at", "is", null),
  ]);
  if (sessionResult.error || links.error)
    throw new Error("Couldn't load this shopping trip.");
  const session = sessionResult.data;
  if (!session || !session.finished_at) return null;
  const [itemsResult, draftResult, shopperResult] = await Promise.all([
    links.data.length > 0
      ? supabase
          .from("grocery_items")
          .select("id, name, quantity, unit, note")
          .eq("household_id", member.householdId)
          .in(
            "id",
            links.data.map((item) => item.grocery_item_id),
          )
      : Promise.resolve({ data: [], error: null }),
    session.draft_expense_id
      ? supabase
          .from("expense_drafts")
          .select("id, description, amount_cents, status")
          .eq("household_id", member.householdId)
          .eq("id", session.draft_expense_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("household_members")
      .select("display_name")
      .eq("household_id", member.householdId)
      .eq("user_id", session.member_id)
      .single(),
  ]);
  if (itemsResult.error || draftResult.error || shopperResult.error)
    throw new Error("Couldn't load this shopping trip's details.");
  const draft = draftResult.data;
  return {
    session,
    draft,
    items: itemsResult.data,
    shopperName: shopperResult.data.display_name,
  };
}

export type ShoppingHistory = NonNullable<
  Awaited<ReturnType<typeof loadShoppingHistory>>
>;
