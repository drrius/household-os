import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { loadHouseholdMembership } from "../lib/household-membership";
import { supabase } from "../lib/supabase";
import { shouldUseMockSession } from "./mock-flag";
import { createSessionLoader } from "./session-loader";

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
  | { status: "signed-out" }
  | { status: "not-a-member" };

export type ReadySession = Extract<SessionState, { status: "ready" }>;

type SessionContextValue = {
  session: SessionState;
  reload: () => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue>({
  session: { status: "loading" },
  reload: () => undefined,
  signOut: async () => undefined,
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
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    reload();
  }, [reload]);

  useEffect(() => {
    if (shouldUseMockSession()) {
      setState(MOCK_SESSION);
      return;
    }
    const loader = createSessionLoader(
      {
        async getUserId() {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            throw new Error(error.message);
          }
          return data.session?.user.id ?? null;
        },
        loadMembership: loadHouseholdMembership,
        signOut: () => supabase.auth.signOut(),
      },
      setState,
    );
    const loadSafely = () => {
      void loader.load();
    };
    loadSafely();
    const { data } = supabase.auth.onAuthStateChange(loadSafely);
    return () => {
      loader.dispose();
      data.subscription.unsubscribe();
    };
  }, [generation]);

  const value = useMemo(
    () => ({ session: state, reload, signOut }),
    [state, reload, signOut],
  );

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

export function useSignOut(): () => Promise<void> {
  return useContext(SessionContext).signOut;
}
