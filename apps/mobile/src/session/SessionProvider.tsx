import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";

export type SessionState =
  | { status: "loading" }
  | { status: "mock"; householdId: string; userId: string; displayName: string }
  | {
      status: "ready";
      householdId: string;
      userId: string;
      displayName: string;
    }
  | { status: "error"; message: string }
  | { status: "signed-out" };

const SessionContext = createContext<SessionState>({ status: "loading" });

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK !== "false";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    if (USE_MOCK) {
      setState({
        status: "mock",
        householdId: "mock-household",
        userId: "mock-user",
        displayName: "Alex",
      });
      return;
    }
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setState({ status: "error", message: error.message });
          return;
        }
        const userId = data.session?.user.id;
        if (!userId) {
          setState({ status: "signed-out" });
          return;
        }
        const { data: membership, error: memberError } = await supabase
          .from("household_members")
          .select("household_id, display_name")
          .eq("user_id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (memberError || !membership) {
          setState({
            status: "error",
            message: memberError?.message ?? "No household membership.",
          });
          return;
        }
        setState({
          status: "ready",
          householdId: membership.household_id as string,
          userId,
          displayName: (membership.display_name as string) ?? "",
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SessionContext.Provider value={state}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
