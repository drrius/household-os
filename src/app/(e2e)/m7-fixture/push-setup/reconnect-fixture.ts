import { registerDeviceForMember } from "@/lib/notifications/push-registration-recovery";
import type { PushSetupEnrollment } from "@/lib/notifications/push-status-browser";

export function reconnectFixture(state: string, log: (text: string) => void) {
  let endpoint: string | null = "https://push.example/old";
  let enabled = false;
  let attempts = 0;
  const registration = {
    pushManager: {
      async getSubscription() {
        if (state === "ownership-lookup-pending" && attempts === 1)
          return new Promise(() => {});
        return endpoint
          ? {
              endpoint,
              async unsubscribe() {
                log("unsubscribe:old");
                if (attempts === 1) {
                  if (state === "ownership-false") return false;
                  if (state === "ownership-reject")
                    throw new Error("Browser unavailable");
                  if (state === "ownership-pending")
                    return new Promise(() => {});
                }
                endpoint = null;
                return true;
              },
            }
          : null;
      },
    },
  } as unknown as ServiceWorkerRegistration;
  return {
    current(): PushSetupEnrollment {
      return {
        status: enabled ? "subscribed" : "unregistered",
        endpoint: endpoint ?? "https://push.example/fresh",
      };
    },
    async enable() {
      attempts += 1;
      await registerDeviceForMember(
        registration,
        async () => {
          endpoint ??= "https://push.example/fresh";
          log(`subscribe:${endpoint}`);
          return { endpoint, p256dh: "fixture", auth: "fixture" };
        },
        async (keys) => {
          log(`register:${keys.endpoint}`);
          if (state === "uncertain" && attempts === 1)
            return { ok: false, error: "Connection lost. Retry safely." };
          if (state !== "uncertain" && keys.endpoint.endsWith("/old")) {
            return {
              ok: false,
              reason: "endpoint_owned",
              error: "Another account",
            };
          }
          enabled = true;
          return { ok: true };
        },
      );
      return this.current();
    },
  };
}
