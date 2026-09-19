import { useCallback, useEffect, useRef, useState } from "react";
import {
  useReloadSession,
  type ReadySession,
  type SessionState,
} from "./SessionProvider";

export type SessionBoundState<T extends object> =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "signed-out" }
  | ({ status: "ready" } & T);

function sessionIdentity(session: SessionState): string {
  switch (session.status) {
    case "ready":
    case "mock":
      return `${session.status}:${session.householdId}:${session.userId}`;
    case "loading":
    case "signed-out":
    case "not-a-member":
    case "error":
      return session.status;
    default: {
      const _exhaustive: never = session;
      return _exhaustive;
    }
  }
}

export function useSessionBoundLoad<T extends object>(
  session: SessionState,
  mock: T,
  load: (ready: ReadySession) => Promise<T>,
): { state: SessionBoundState<T>; refresh: () => void } {
  const reloadSession = useReloadSession();
  const [attempt, setAttempt] = useState(0);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<SessionBoundState<T>>({
    status: "loading",
  });
  const loadedIdentity = useRef<string | null>(null);
  const loadRef = useRef(load);
  const mockRef = useRef(mock);
  loadRef.current = load;
  mockRef.current = mock;

  useEffect(() => {
    const identity = sessionIdentity(session);
    if (session.status === "loading") {
      loadedIdentity.current = null;
      setState({ status: "loading" });
      return;
    }
    if (session.status === "signed-out" || session.status === "not-a-member") {
      loadedIdentity.current = null;
      setState({ status: "signed-out" });
      return;
    }
    if (session.status === "error") {
      loadedIdentity.current = null;
      setState({
        status: "error",
        message: session.message,
        retry: reloadSession,
      });
      return;
    }
    if (session.status === "mock") {
      loadedIdentity.current = identity;
      setState({ status: "ready", ...mockRef.current });
      return;
    }
    if (loadedIdentity.current !== identity) {
      setState({ status: "loading" });
    }
    let cancelled = false;
    void loadRef.current(session).then(
      (result) => {
        if (cancelled) return;
        loadedIdentity.current = identity;
        setState({ status: "ready", ...result });
      },
      (error: unknown) => {
        if (cancelled) return;
        loadedIdentity.current = null;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Load failed",
          retry: () => setAttempt((n) => n + 1),
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [session, attempt, tick, reloadSession]);

  return {
    state,
    refresh: useCallback(() => setTick((n) => n + 1), []),
  };
}
