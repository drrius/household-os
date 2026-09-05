import "server-only";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { loadShoppingHistory } from "@/lib/groceries/shopping-history";
import { groceryDetailSchemas as schemas } from "./definitions/grocery-detail-tools";
export async function readGroceryHistory(
  name: string,
  input: unknown,
): Promise<Record<string, unknown>> {
  if (name === "get_shopping_trip") {
    const value = schemas.get_shopping_trip.parse(input);
    const trip = await loadShoppingHistory(value.sessionId);
    if (!trip) throw new Error("This shopping trip is unavailable.");
    return trip;
  }
  const { page } = schemas.get_grocery_history.parse(input);
  const { householdId } = await requireMemberContext();
  const db = await createClient();
  const [items, sessions] = await Promise.all([
    db
      .from("grocery_items")
      .select("id,name,quantity,unit,category_id,note,purchased_at")
      .eq("household_id", householdId)
      .eq("state", "purchased")
      .order("purchased_at", { ascending: false })
      .order("id")
      .range(page * 30, page * 30 + 30),
    db
      .from("shopping_sessions")
      .select(
        "id,member_id,finished_at,cancelled_at,receipt_total_cents,draft_expense_id",
      )
      .eq("household_id", householdId)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .order("id")
      .range(page * 30, page * 30 + 30),
  ]);
  if (items.error || sessions.error || !items.data || !sessions.data)
    throw new Error("Could not load shopping history.");
  return {
    items: items.data.slice(0, 30),
    hasMoreItems: items.data.length > 30,
    sessions: sessions.data.slice(0, 30),
    hasMoreSessions: sessions.data.length > 30,
    page,
  };
}
