import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/app/security/sign-out-action", () => ({
  signOutThisDevice: vi.fn(),
}));
import { discoverSignOutSubscription } from "./sign-out-control";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function worker(getRegistration: () => unknown) {
  vi.stubGlobal("navigator", { serviceWorker: { getRegistration } });
}
it("returns the exact discovered subscription and clears its timeout", async () => {
  const subscription = { endpoint: "https://push.example/device" };
  worker(async () => ({
    pushManager: { getSubscription: async () => subscription },
  }));
  await expect(discoverSignOutSubscription()).resolves.toBe(subscription);
  expect(vi.getTimerCount()).toBe(0);
});
it.each(["registration", "subscription"])(
  "treats rejected %s discovery as unknown",
  async (step) => {
    worker(async () => {
      if (step === "registration")
        throw new Error("Service worker unavailable");
      return {
        pushManager: {
          getSubscription: async () => {
            throw new Error("Push unavailable");
          },
        },
      };
    });
    await expect(discoverSignOutSubscription()).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  },
);
it.each(["registration", "subscription"])(
  "bounds never-resolving %s discovery",
  async (step) => {
    worker(() =>
      step === "registration"
        ? new Promise(() => {})
        : Promise.resolve({
            pushManager: { getSubscription: () => new Promise(() => {}) },
          }),
    );
    const result = discoverSignOutSubscription();
    await vi.advanceTimersByTimeAsync(500);
    await expect(result).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  },
);
it("handles a discovery rejection that arrives after the deadline", async () => {
  let rejectLookup!: (error: Error) => void;
  worker(
    () =>
      new Promise((_resolve, reject) => {
        rejectLookup = reject;
      }),
  );
  const result = discoverSignOutSubscription();
  await vi.advanceTimersByTimeAsync(500);
  await expect(result).resolves.toBeNull();
  rejectLookup(new Error("Late browser rejection"));
  await Promise.resolve();
});
it("works when service workers or push support are absent", async () => {
  vi.stubGlobal("navigator", {});
  await expect(discoverSignOutSubscription()).resolves.toBeNull();
  worker(async () => ({}));
  await expect(discoverSignOutSubscription()).resolves.toBeNull();
});
