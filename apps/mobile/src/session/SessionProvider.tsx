import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { shouldUseMockSession } from "./mock-flag";

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

export type ReadySession = Extract<SessionState, { status: "ready" }>;

type SessionContextValue = {
  session: SessionState;
  reload: () => void;
};

const SessionContext = createContext<SessionContextValue>({
  session: { status: "loading" },
  reload: () => undefined,
});

const MOCK_SESSION = {
  status: "mock",
  householdId: "mock-household",
  userId: "mock-user",
  displayName: "Alex",
} as const;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const [generation, setGeneration] = useState(0);
  const reload = useCallback(() => setGeneration((n) => n + 1), []);

  useEffect(() => {
    if (shouldUseMockSession()) {
      setState(MOCK_SESSION);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.auth.getSession();
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
    };
    void load().catch((error: unknown) => {
      if (!cancelled) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
    const { data } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [generation]);

  const value = useMemo(() => ({ session: state, reload }), [state, reload]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  return useContext(SessionContext).session;
}

export function useReloadSession(): () => void {
  return useContext(SessionContext).reload;
}
