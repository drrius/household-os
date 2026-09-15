import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { SessionState } from "../session/SessionProvider";

const WATCHED_TABLES = [
  "routine_occurrences",
  "routine_completions",
  "routines",
  "meal_plan_entries",
  "grocery_items",
  "shopping_sessions",
  "expense_drafts",
  "financial_events",
  "ledger_entries",
  "inbox_notifications",
  "activity_events",
] as const;

export function useHouseholdRealtime(
  session: SessionState,
  onChange: () => void
): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (session.status !== "ready") return;
    const householdId = session.householdId;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        onChangeRef.current();
      }, 800);
    };
    const channel = supabase.channel(`household-${householdId}`);
    for (const table of WATCHED_TABLES) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `household_id=eq.${householdId}`,
        },
        schedule
      );
    }
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
}
