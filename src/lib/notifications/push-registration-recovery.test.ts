import { afterEach, expect, it, vi } from "vitest";
import {
  registerDeviceForMember,
  PushReconnectError,
} from "./push-registration-recovery";

const original = {
  endpoint: "https://push.example/old",
  auth: "key",
  p256dh: "key",
};
const fresh = { ...original, endpoint: "https://push.example/fresh" };
const conflict = {
  ok: false,
  reason: "endpoint_owned",
  error: "Another account",
} as const;
afterEach(() => vi.useRealTimers());
function setup(unsubscribe = vi.fn().mockResolvedValue(true)) {
  const getSubscription = vi
    .fn()
    .mockResolvedValue({ endpoint: original.endpoint, unsubscribe });
  const registration = {
    pushManager: { getSubscription },
  } as unknown as ServiceWorkerRegistration;
  const subscribe = vi
    .fn()
    .mockResolvedValueOnce(original)
    .mockResolvedValue(fresh);
  const register = vi
    .fn()
    .mockResolvedValueOnce(conflict)
    .mockResolvedValue({ ok: true });
  return { registration, subscribe, register, unsubscribe, getSubscription };
}
it("replaces an endpoint only after explicit confirmed ownership rejection", async () => {
  const task = setup();
  await registerDeviceForMember(
    task.registration,
    task.subscribe,
    task.register,
  );
  expect(task.unsubscribe).toHaveBeenCalledOnce();
  expect(task.register.mock.calls).toEqual([[original], [fresh]]);
  expect(task.unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(
    task.subscribe.mock.invocationCallOrder[1]!,
  );
});
it.each([
  "Connection lost",
  "authentication required",
  "caller is not a household member",
  "Another account",
])(
  "preserves the endpoint for generic or uncertain error: %s",
  async (error) => {
    const task = setup();
    task.register.mockReset().mockResolvedValue({ ok: false, error });
    await expect(
      registerDeviceForMember(task.registration, task.subscribe, task.register),
    ).rejects.toThrow(error);
    expect(task.unsubscribe).not.toHaveBeenCalled();
    expect(task.subscribe).toHaveBeenCalledOnce();
  },
);
it.each([false, "reject", "throw"])(
  "does not subscribe again when cleanup returns %s",
  async (mode) => {
    const unsubscribe = vi.fn(() => {
      if (mode === "throw") throw new Error("Browser failed");
      if (mode === "reject") return Promise.reject(new Error("Browser failed"));
      return Promise.resolve(false);
    });
    const task = setup(unsubscribe);
    await expect(
      registerDeviceForMember(task.registration, task.subscribe, task.register),
    ).rejects.toThrow("notification settings");
    expect(task.subscribe).toHaveBeenCalledOnce();
    expect(task.register).toHaveBeenCalledOnce();
  },
);
it("bounds stalled cleanup and leaves a recoverable error", async () => {
  vi.useFakeTimers();
  const task = setup(vi.fn(() => new Promise(() => {})));
  const attempt = registerDeviceForMember(
    task.registration,
    task.subscribe,
    task.register,
  );
  const assertion = expect(attempt).rejects.toThrow("notification settings");
  await vi.advanceTimersByTimeAsync(2000);
  await assertion;
  expect(task.subscribe).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
it("does not unsubscribe an endpoint changed concurrently by another tab", async () => {
  const task = setup();
  task.getSubscription.mockResolvedValue({
    endpoint: fresh.endpoint,
    unsubscribe: task.unsubscribe,
  });
  await expect(
    registerDeviceForMember(task.registration, task.subscribe, task.register),
  ).rejects.toThrow("notification settings");
  expect(task.unsubscribe).not.toHaveBeenCalled();
});
it("preserves a fresh endpoint after an uncertain replacement registration response", async () => {
  const task = setup();
  task.register
    .mockReset()
    .mockResolvedValueOnce(conflict)
    .mockRejectedValueOnce(new Error("Response lost"));
  await expect(
    registerDeviceForMember(task.registration, task.subscribe, task.register),
  ).rejects.toThrow("Response lost");
  expect(task.unsubscribe).toHaveBeenCalledOnce();
  expect(task.register).toHaveBeenCalledTimes(2);
});
it("never loops if the replacement also reports a conflict or repeats the old endpoint", async () => {
  const task = setup();
  task.register.mockReset().mockResolvedValue(conflict);
  await expect(
    registerDeviceForMember(task.registration, task.subscribe, task.register),
  ).rejects.toThrow("Another account");
  expect(task.register).toHaveBeenCalledTimes(2);
  const same = setup();
  same.subscribe.mockReset().mockResolvedValue(original);
  await expect(
    registerDeviceForMember(same.registration, same.subscribe, same.register),
  ).rejects.toThrow("notification settings");
  expect(same.register).toHaveBeenCalledOnce();
});

it("bounds a stalled lookup and marks it to avoid repeating the failed discovery", async () => {
  vi.useFakeTimers();
  const task = setup();
  task.getSubscription.mockImplementation(() => new Promise(() => {}));
  const assertion = expect(
    registerDeviceForMember(task.registration, task.subscribe, task.register),
  ).rejects.toBeInstanceOf(PushReconnectError);
  await vi.advanceTimersByTimeAsync(2000);
  await assertion;
  expect(task.unsubscribe).not.toHaveBeenCalled();
  expect(task.subscribe).toHaveBeenCalledOnce();
});
