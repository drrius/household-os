import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  channels: new Map<
    string,
    {
      active: boolean;
      leaving: boolean;
      listeners: Map<string, (payload: { table: string }) => void>;
      on: ReturnType<typeof vi.fn>;
      subscribe: ReturnType<typeof vi.fn>;
    }
  >(),
  finishRemoval: [] as (() => void)[],
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel(topic: string) {
      const existing = state.channels.get(topic);
      if (existing) return existing;
      const channel = {
        active: false,
        leaving: false,
        listeners: new Map<string, (payload: { table: string }) => void>(),
        on: vi.fn((_kind, filter, callback) => {
          channel.listeners.set(filter.table, callback);
          return channel;
        }),
        subscribe: vi.fn((callback) => {
          if (!channel.leaving) {
            channel.active = true;
            callback("SUBSCRIBED");
          }
          return channel;
        }),
      };
      state.channels.set(topic, channel);
      return channel;
    },
    removeChannel(channel: { active: boolean; leaving: boolean }) {
      channel.leaving = true;
      return new Promise<void>((resolve) => {
        state.finishRemoval.push(() => {
          for (const [topic, existing] of state.channels) {
            if (existing === channel) state.channels.delete(topic);
          }
          resolve();
        });
      });
    },
  }),
}));
import { subscribeHouseholdSurfaces } from "./surfaces";

beforeEach(() => {
  vi.useFakeTimers();
  state.channels.clear();
  state.finishRemoval = [];
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { visibilityState: "visible" }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("keeps the replacement subscription alive while the previous section's channel closes", async () => {
  const oldDirty = vi.fn();
  const nextDirty = vi.fn();
  const stopOld = subscribeHouseholdSurfaces({
    householdId: "home",
    onDirty: oldDirty,
  });
  await vi.advanceTimersByTimeAsync(50);
  oldDirty.mockClear();
  stopOld();
  const stopNext = subscribeHouseholdSurfaces({
    householdId: "home",
    onDirty: nextDirty,
  });
  await vi.advanceTimersByTimeAsync(50);
  nextDirty.mockClear();
  for (const finish of state.finishRemoval) finish();
  for (const channel of state.channels.values()) {
    if (channel.active && !channel.leaving)
      channel.listeners.get("routines")?.({ table: "routines" });
  }
  await vi.advanceTimersByTimeAsync(50);
  expect(nextDirty).toHaveBeenCalledWith(expect.arrayContaining(["today"]));
  expect(oldDirty).not.toHaveBeenCalled();
  stopNext();
});
it("ignores change callbacks that arrive after cleanup while unsubscribe is pending", async () => {
  const onDirty = vi.fn();
  const stop = subscribeHouseholdSurfaces({ householdId: "home", onDirty });
  await vi.advanceTimersByTimeAsync(50);
  onDirty.mockClear();
  const channel = [...state.channels.values()][0]!;
  stop();
  channel.listeners.get("routines")?.({ table: "routines" });
  await vi.advanceTimersByTimeAsync(50);
  expect(onDirty).not.toHaveBeenCalled();
});
