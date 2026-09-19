import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { createSessionLoader, type LoadedSession } from "./session-loader";

type Membership = { householdId: string; displayName: string } | null;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function setup() {
  const older = deferred<Membership>();
  const newer = deferred<Membership>();
  const states: LoadedSession[] = [];
  const signOut = vi.fn(async () => undefined);
  const loader = createSessionLoader(
    {
      getUserId: vi
        .fn()
        .mockResolvedValueOnce("old-user")
        .mockResolvedValue("new-user"),
      loadMembership: vi
        .fn()
        .mockReturnValueOnce(older.promise)
        .mockReturnValue(newer.promise),
      signOut,
    },
    (state) => states.push(state),
  );
  return { older, newer, states, signOut, loader };
}

const membership = { householdId: "household", displayName: "Alex" };
const ready = { status: "ready", userId: "new-user", ...membership };

describe("session load ordering", () => {
  it("keeps a newer successful login when an older load fails", async () => {
    const { loader, older, newer, states } = setup();
    const oldLoad = loader.load();
    const newLoad = loader.load();
    newer.resolve(membership);
    await newLoad;
    older.reject(new Error("Old network failure"));
    await oldLoad;
    expect(states).toEqual([ready]);
  });

  it("does not sign out a newer member after an outdated membership denial", async () => {
    const { loader, older, newer, states, signOut } = setup();
    const oldLoad = loader.load();
    const newLoad = loader.load();
    newer.resolve(membership);
    await newLoad;
    older.resolve(null);
    await oldLoad;
    expect(states).toEqual([ready]);
    expect(signOut).not.toHaveBeenCalled();
  });

  it.each(["success", "error", "denied"] as const)(
    "ignores pending %s after disposal",
    async (outcome) => {
      const { loader, older, states, signOut } = setup();
      const load = loader.load();
      loader.dispose();
      if (outcome === "error") older.reject(new Error("Disconnected"));
      else older.resolve(outcome === "denied" ? null : membership);
      await load;
      await loader.load();
      expect(states).toEqual([]);
      expect(signOut).not.toHaveBeenCalled();
    },
  );

  it("reports the latest error even when an older success arrives later", async () => {
    const { loader, older, newer, states } = setup();
    const oldLoad = loader.load();
    const newLoad = loader.load();
    newer.reject(new Error("Membership unavailable"));
    await newLoad;
    older.resolve(membership);
    await oldLoad;
    expect(states).toEqual([
      { status: "error", message: "Membership unavailable" },
    ]);
  });

  it("signs out when the current user is not a member", async () => {
    const { loader, older, states, signOut } = setup();
    const load = loader.load();
    older.resolve(null);
    await load;
    expect(states).toEqual([{ status: "not-a-member" }]);
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("publishes only the latest request regardless of completion order", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.shuffledSubarray([0, 1, 2], { minLength: 3, maxLength: 3 }),
        async (order) => {
          const pending = [
            deferred<string | null>(),
            deferred<string | null>(),
            deferred<string | null>(),
          ];
          let next = 0;
          const states: LoadedSession[] = [];
          const loader = createSessionLoader(
            {
              getUserId: () => pending[next++]!.promise,
              loadMembership: async () => membership,
              signOut: async () => undefined,
            },
            (state) => states.push(state),
          );
          const loads = pending.map(() => loader.load());
          for (const index of order) {
            pending[index]!.resolve(`user-${index}`);
            await loads[index];
          }
          expect(states).toEqual([{ ...ready, userId: "user-2" }]);
        },
      ),
    );
  });
});
