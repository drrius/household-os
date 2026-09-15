import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { SessionState } from "../session/SessionProvider";
import { mockGroceries } from "./mockGroceries";
import type { GroceriesViewModel } from "./types";

export type GroceriesState =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "signed-out" }
  | { status: "ready"; model: GroceriesViewModel };

export function useGroceries(session: SessionState): GroceriesState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<GroceriesState>({ status: "loading" });

  useEffect(() => {
    if (session.status === "loading") {
      setState({ status: "loading" });
      return;
    }
    if (session.status === "signed-out") {
      setState({ status: "signed-out" });
      return;
    }
    if (session.status === "error") {
      setState({
        status: "error",
        message: session.message,
        retry: () => setAttempt((n) => n + 1),
      });
      return;
    }
    if (session.status === "mock") {
      setState({ status: "ready", model: mockGroceries });
      return;
    }
    let cancelled = false;
    const { householdId, userId } = session;
    void loadGroceries(householdId, userId).then(
      (model) => {
        if (!cancelled) setState({ status: "ready", model });
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Load failed",
            retry: () => setAttempt((n) => n + 1),
          });
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [session, attempt]);

  return state;
}

async function loadGroceries(
  householdId: string,
  userId: string
): Promise<GroceriesViewModel> {
  const [catsRes, itemsRes, sessionsRes, membersRes] = await Promise.all([
    supabase
      .from("grocery_categories")
      .select("id, name, sort_order")
      .eq("household_id", householdId)
      .order("sort_order")
      .order("id"),
    supabase
      .from("grocery_items")
      .select(
        "id, name, quantity, unit, category_id, note, claimed_by_session_id"
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
  const categories = ((catsRes.data ?? []) as {
    id: string;
    name: string;
  }[]).map((c) => ({
    id: c.id,
    name: c.name,
    items: items
      .filter((i) => i.category_id === c.id)
      .map((i) => {
        const claimSession = sessions.find(
          (s) => s.id === i.claimed_by_session_id
        );
        return {
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          note: i.note,
          claimedByName: claimSession ? nameOf(claimSession.member_id) : null,
          claimedByMe: claimSession?.member_id === userId,
        };
      }),
  }));
  const uncategorized = items.filter(
    (i) => !categories.some((c) => c.id === i.category_id)
  );
  if (uncategorized.length > 0) {
    categories.push({
      id: "uncategorized",
      name: "Uncategorized",
      items: uncategorized.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        note: i.note,
        claimedByName: null,
        claimedByMe: false,
      })),
    });
  }

  const firstSession = sessions[0] ?? null;
  return {
    activeItemCount: items.length,
    categories,
    liveSession: firstSession
      ? {
          memberName: nameOf(firstSession.member_id),
          claimedCount: items.filter(
            (i) => i.claimed_by_session_id === firstSession.id
          ).length,
          totalCount: items.length,
          isMine: firstSession.member_id === userId,
        }
      : null,
    duplicateCount: 0,
    historyLabel: null,
  };
}
