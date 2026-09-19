import {
  resolveAuthenticatedSession,
  type ResolvedSession,
} from "./resolve-session";

export type LoadedSession =
  ResolvedSession | { status: "error"; message: string };

export function createSessionLoader(
  input: Parameters<typeof resolveAuthenticatedSession>[0],
  publish: (session: LoadedSession) => void,
) {
  let latestRequest = 0;
  let disposed = false;

  return {
    async load(): Promise<void> {
      if (disposed) return;
      const request = ++latestRequest;
      const isCurrent = () => !disposed && request === latestRequest;
      try {
        const session = await resolveAuthenticatedSession({
          ...input,
          async signOut() {
            // A superseded membership check must not sign out the new session.
            if (isCurrent()) await input.signOut();
          },
        });
        if (isCurrent()) publish(session);
      } catch (error: unknown) {
        if (isCurrent()) {
          publish({
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    },
    dispose() {
      disposed = true;
    },
  };
}
