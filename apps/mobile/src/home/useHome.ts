import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { SessionState } from "../session/SessionProvider";
import { mockHome, mockInbox } from "./mockHome";
import type { HomeViewModel, InboxViewModel } from "./types";

export type HomeState =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "signed-out" }
  | { status: "ready"; model: HomeViewModel; inbox: InboxViewModel };

export function useHome(session: SessionState): HomeState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<HomeState>({ status: "loading" });

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
      setState({ status: "ready", model: mockHome, inbox: mockInbox });
      return;
    }
    let cancelled = false;
    const { householdId, userId } = session;
    void loadHome(householdId, userId).then(
      ({ model, inbox }) => {
        if (!cancelled) setState({ status: "ready", model, inbox });
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

async function loadHome(
  householdId: string,
  userId: string
): Promise<{ model: HomeViewModel; inbox: InboxViewModel }> {
  const [houseRes, membersRes, petsRes, areasRes, routinesRes, activityRes, inboxRes] =
    await Promise.all([
      supabase.from("households").select("name").eq("id", householdId).maybeSingle(),
      supabase
        .from("household_members")
        .select("user_id, display_name")
        .eq("household_id", householdId)
        .order("joined_at")
        .order("user_id"),
      supabase
        .from("pets")
        .select("id, name")
        .eq("household_id", householdId)
        .is("archived_at", null)
        .order("name"),
      supabase
        .from("areas")
        .select("id, name, sort_order")
        .eq("household_id", householdId)
        .is("archived_at", null)
        .order("sort_order")
        .order("name"),
      supabase
        .from("routines")
        .select("id, title, area_id, paused_at")
        .eq("household_id", householdId)
        .is("archived_at", null),
      supabase
        .from("activity_events")
        .select("id, kind, created_at")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("inbox_notifications")
        .select("id, kind, payload, read_at, created_at")
        .eq("household_id", householdId)
        .eq("recipient_member_id", userId)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

  const members = ((membersRes.data ?? []) as {
    user_id: string;
    display_name: string;
  }[]).map((m) => ({
    userId: m.user_id,
    displayName: m.display_name,
    isSelf: m.user_id === userId,
  }));
  const areas = (areasRes.data ?? []) as { id: string; name: string }[];
  const areaName = (id: string | null) =>
    areas.find((a) => a.id === id)?.name ?? "Household";
  const routines = ((routinesRes.data ?? []) as {
    id: string;
    title: string;
    area_id: string | null;
    paused_at: string | null;
  }[]).map((r) => ({
    id: r.id,
    title: r.title,
    areaName: areaName(r.area_id),
    paused: r.paused_at != null,
  }));
  const inbox = (inboxRes.data ?? []) as {
    id: string;
    kind: string;
    read_at: string | null;
  }[];

  return {
    model: {
      householdLabel:
        (houseRes.data as { name: string } | null)?.name ?? "Household",
      members,
      pets: (petsRes.data ?? []) as { id: string; name: string }[],
      areas: areas.map((a) => ({ id: a.id, name: a.name })),
      routines,
      activity: ((activityRes.data ?? []) as { id: string; kind: string }[]).map(
        (a) => ({ id: a.id, title: a.kind })
      ),
    },
    inbox: {
      unreadCount: inbox.filter((n) => n.read_at == null).length,
      items: inbox.map((n) => ({
        id: n.id,
        title: n.kind,
        body: "",
        read: n.read_at != null,
      })),
    },
  };
}
