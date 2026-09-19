import { supabase } from "../lib/supabase";
import { throwIfAnyQueryFailed } from "../lib/query";
import type { ReadySession, SessionState } from "../session/SessionProvider";
import { useSessionBoundLoad } from "../session/useSessionBoundLoad";
import { mockHome, mockInbox } from "./mockHome";
import type { HomeViewModel, InboxViewModel } from "./types";

export type HomeState =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "signed-out" }
  | { status: "ready"; model: HomeViewModel; inbox: InboxViewModel };

export function useHome(session: SessionState): {
  state: HomeState;
  refresh: () => void;
} {
  return useSessionBoundLoad(
    session,
    { model: mockHome, inbox: mockInbox },
    loadHome,
  );
}

async function loadHome(session: ReadySession): Promise<{
  model: HomeViewModel;
  inbox: InboxViewModel;
}> {
  const { householdId, userId } = session;
  const [
    houseRes,
    membersRes,
    petsRes,
    areasRes,
    routinesRes,
    activityRes,
    inboxRes,
    unreadRes,
  ] = await Promise.all([
    supabase
      .from("households")
      .select("name")
      .eq("id", householdId)
      .maybeSingle(),
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
    supabase
      .from("inbox_notifications")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("recipient_member_id", userId)
      .is("read_at", null),
  ]);

  throwIfAnyQueryFailed([
    { label: "Household", error: houseRes.error },
    { label: "Members", error: membersRes.error },
    { label: "Pets", error: petsRes.error },
    { label: "Areas", error: areasRes.error },
    { label: "Routines", error: routinesRes.error },
    { label: "Activity", error: activityRes.error },
    { label: "Inbox", error: inboxRes.error },
    { label: "Unread inbox", error: unreadRes.error },
  ]);

  const members = (
    (membersRes.data ?? []) as { user_id: string; display_name: string }[]
  ).map((m) => ({
    userId: m.user_id,
    displayName: m.display_name,
    isSelf: m.user_id === userId,
  }));
  const areas = (areasRes.data ?? []) as { id: string; name: string }[];
  const areaName = (id: string | null) =>
    areas.find((a) => a.id === id)?.name ?? "Household";
  const routines = (
    (routinesRes.data ?? []) as {
      id: string;
      title: string;
      area_id: string | null;
      paused_at: string | null;
    }[]
  ).map((r) => ({
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
      activity: (
        (activityRes.data ?? []) as { id: string; kind: string }[]
      ).map((a) => ({ id: a.id, title: a.kind })),
    },
    inbox: {
      unreadCount: unreadRes.count ?? 0,
      items: inbox.map((n) => ({
        id: n.id,
        title: n.kind,
        body: "",
        read: n.read_at != null,
      })),
    },
  };
}
