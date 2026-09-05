import { expect, it, vi } from "vitest";
vi.mock("@/app/(product)/_actions/notifications", () => ({
  registerPushSubscriptionAction: vi.fn(),
  unregisterPushSubscriptionAction: vi.fn(),
}));
vi.mock("@/app/(product)/_actions/push-status", () => ({
  readPushRegistrationAction: vi.fn(),
  enqueueDevicePushTestAction: vi.fn(),
  readDevicePushTestAction: vi.fn(),
}));
vi.mock("@/lib/pwa/push-enrollment", () => ({
  registerHouseholdServiceWorker: vi.fn(),
  detectPushEnrollment: vi.fn(),
  subscribeDevicePush: vi.fn(),
}));
import { reconcilePushEnrollment } from "./push-status-browser";

it("a browser subscription is enabled only with active server registration", async () => {
  const browser = {
    status: "subscribed",
    endpoint: "https://push.example/device",
  } as const;
  const read = vi
    .fn()
    .mockResolvedValue({ ok: true, value: { registered: false } });
  await expect(reconcilePushEnrollment(browser, read)).resolves.toEqual({
    ...browser,
    status: "unregistered",
  });
  read.mockResolvedValueOnce({ ok: true, value: { registered: true } });
  await expect(reconcilePushEnrollment(browser, read)).resolves.toEqual(
    browser,
  );
  read.mockResolvedValueOnce({ ok: false, error: "Connection failed" });
  await expect(reconcilePushEnrollment(browser, read)).rejects.toThrow(
    "Connection failed",
  );
});
it("permission states never trigger registration or permission requests during reconciliation", async () => {
  const read = vi.fn();
  for (const status of [
    "needs-permission",
    "denied",
    "needs-install",
    "unsubscribed",
    "unsupported",
    "missing-vapid",
  ] as const) {
    await expect(reconcilePushEnrollment({ status }, read)).resolves.toEqual({
      status,
    });
  }
  expect(read).not.toHaveBeenCalled();
});

it("failed browser unsubscribe cannot claim disabled server registration is enabled", async () => {
  const { registerHouseholdServiceWorker, detectPushEnrollment } =
    await import("@/lib/pwa/push-enrollment");
  const { unregisterPushSubscriptionAction } =
    await import("@/app/(product)/_actions/notifications");
  const { readPushRegistrationAction } =
    await import("@/app/(product)/_actions/push-status");
  const { pushSetupOperations } = await import("./push-status-browser");
  const endpoint = "https://push.example/device";
  const unsubscribe = vi.fn().mockResolvedValue(false);
  vi.mocked(registerHouseholdServiceWorker).mockResolvedValue({
    pushManager: { getSubscription: async () => ({ unsubscribe }) },
  } as unknown as ServiceWorkerRegistration);
  vi.mocked(detectPushEnrollment).mockResolvedValue({
    status: "subscribed",
    endpoint,
  });
  vi.mocked(unregisterPushSubscriptionAction).mockResolvedValue({ ok: true });
  vi.mocked(readPushRegistrationAction).mockResolvedValue({
    ok: true,
    value: { registered: false },
  });
  vi.stubGlobal("navigator", { serviceWorker: {} });
  await expect(pushSetupOperations.disable(endpoint)).resolves.toEqual({
    status: "unregistered",
    endpoint,
  });
  expect(unsubscribe).toHaveBeenCalledOnce();
  vi.unstubAllGlobals();
});
