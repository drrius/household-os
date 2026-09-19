import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
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

type HouseholdSubscription = {
  refs: number;
  callbacks: Set<() => void>;
  channel: RealtimeChannel;
  timer: ReturnType<typeof setTimeout> | null;
};

const subscriptions = new Map<string, HouseholdSubscription>();

function schedule(entry: HouseholdSubscription) {
  if (entry.timer) return;
  entry.timer = setTimeout(() => {
    entry.timer = null;
    for (const callback of entry.callbacks) {
      callback();
    }
  }, 800);
}

function subscribeHousehold(householdId: string): HouseholdSubscription {
  const existing = subscriptions.get(householdId);
  if (existing) return existing;

  const entry: HouseholdSubscription = {
    refs: 0,
    callbacks: new Set(),
    channel: supabase.channel(`household-mobile:${householdId}`),
    timer: null,
  };
  for (const table of WATCHED_TABLES) {
    entry.channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `household_id=eq.${householdId}`,
      },
      () => schedule(entry),
    );
  }
  entry.channel.subscribe();
  subscriptions.set(householdId, entry);
  return entry;
}

function releaseHousehold(householdId: string, callback: () => void) {
  const entry = subscriptions.get(householdId);
  if (!entry) return;
  entry.callbacks.delete(callback);
  entry.refs -= 1;
  if (entry.refs > 0) return;
  if (entry.timer) clearTimeout(entry.timer);
  void supabase.removeChannel(entry.channel);
  subscriptions.delete(householdId);
}

export function useHouseholdRealtime(
  session: SessionState,
  onChange: () => void,
): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const householdId = session.status === "ready" ? session.householdId : null;
  useEffect(() => {
    if (!householdId) return;
    const callback = () => onChangeRef.current();
    const entry = subscribeHousehold(householdId);
    entry.refs += 1;
    entry.callbacks.add(callback);
    return () => {
      releaseHousehold(householdId, callback);
    };
  }, [householdId]);
}
