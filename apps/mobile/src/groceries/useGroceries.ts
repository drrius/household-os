import { supabase } from "../lib/supabase";
import { throwIfAnyQueryFailed } from "../lib/query";
import type { ReadySession, SessionState } from "../session/SessionProvider";
import { useSessionBoundLoad } from "../session/useSessionBoundLoad";
import { mockGroceries } from "./mockGroceries";
import type { GroceryItemView, GroceriesViewModel } from "./types";

export type GroceriesState =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "signed-out" }
  | { status: "ready"; model: GroceriesViewModel };

const HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;

export function useGroceries(session: SessionState): {
  state: GroceriesState;
  refresh: () => void;
} {
  return useSessionBoundLoad(session, { model: mockGroceries }, loadGroceries);
}

function toItemView(
  item: {
    id: string;
    name: string;
    quantity: string | null;
    unit: string | null;
    note: string | null;
    claimed_by_session_id: string | null;
  },
  sessions: readonly { id: string; member_id: string }[],
  nameOf: (id: string) => string,
  userId: string,
): GroceryItemView {
  const claimSession = sessions.find(
    (s) => s.id === item.claimed_by_session_id,
  );
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    note: item.note,
    claimedByName: claimSession ? nameOf(claimSession.member_id) : null,
    claimedByMe: claimSession?.member_id === userId,
  };
}

function historyLabel(count: number): string | null {
  if (count === 0) return null;
  return `${count} ${count === 1 ? "item" : "items"} purchased in the last 30 days`;
}

async function loadGroceries(
  session: ReadySession,
): Promise<{ model: GroceriesViewModel }> {
  const { householdId, userId } = session;
  const historyStart = new Date(Date.now() - HISTORY_WINDOW_MS).toISOString();
  const [catsRes, itemsRes, sessionsRes, membersRes, historyRes] =
    await Promise.all([
      supabase
        .from("grocery_categories")
        .select("id, name, sort_order")
        .eq("household_id", householdId)
        .order("sort_order")
        .order("id"),
      supabase
        .from("grocery_items")
        .select(
          "id, name, quantity, unit, category_id, note, claimed_by_session_id",
        )
        .eq("household_id", householdId)
        .in("state", ["active", "claimed"])
        .order("sort_order")
        .order("id"),
      supabase
        .from("shopping_sessions")
        .select("id, member_id, started_at")
        .eq("household_id", householdId)
        .is("finished_at", null)
        .order("started_at", { ascending: false }),
      supabase
        .from("household_members")
        .select("user_id, display_name")
        .eq("household_id", householdId),
      supabase
        .from("grocery_items")
        .select("id", { count: "exact", head: true })
        .eq("household_id", householdId)
        .eq("state", "purchased")
        .gte("purchased_at", historyStart),
    ]);

  throwIfAnyQueryFailed([
    { label: "Grocery categories", error: catsRes.error },
    { label: "Grocery items", error: itemsRes.error },
    { label: "Shopping sessions", error: sessionsRes.error },
    { label: "Members", error: membersRes.error },
    { label: "Grocery history", error: historyRes.error },
  ]);

  const members = (membersRes.data ?? []) as {
    user_id: string;
    display_name: string;
  }[];
  const nameOf = (id: string) =>
    members.find((m) => m.user_id === id)?.display_name ?? "?";
  const sessions = (sessionsRes.data ?? []) as {
    id: string;
    member_id: string;
  }[];
  const items = (itemsRes.data ?? []) as {
    id: string;
    name: string;
    quantity: string | null;
    unit: string | null;
    category_id: string | null;
    note: string | null;
    claimed_by_session_id: string | null;
  }[];
  const categories = (
    (catsRes.data ?? []) as { id: string; name: string }[]
  ).map((c) => ({
    id: c.id,
    name: c.name,
    items: items
      .filter((i) => i.category_id === c.id)
      .map((i) => toItemView(i, sessions, nameOf, userId)),
  }));
  const uncategorized = items.filter(
    (i) => !categories.some((c) => c.id === i.category_id),
  );
  if (uncategorized.length > 0) {
    categories.push({
      id: "uncategorized",
      name: "Uncategorized",
      items: uncategorized.map((i) => toItemView(i, sessions, nameOf, userId)),
    });
  }

  const firstSession = sessions[0] ?? null;
  return {
    model: {
      activeItemCount: items.length,
      categories,
      liveSession: firstSession
        ? {
            id: firstSession.id,
            memberName: nameOf(firstSession.member_id),
            claimedCount: items.filter(
              (i) => i.claimed_by_session_id === firstSession.id,
            ).length,
            totalCount: items.length,
            isMine: firstSession.member_id === userId,
          }
        : null,
      duplicateCount: 0,
      historyLabel: historyLabel(historyRes.count ?? 0),
    },
  };
}
