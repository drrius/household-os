import type { PushSubscriptionKeys } from "@/lib/pwa/push-enrollment";
import type { PushRegistrationResult } from "./push-status-contract";

const RECOVERY_ERROR =
  "This browser could not release its previous push subscription. Check its notification settings, then reconnect this device.";

export class PushReconnectError extends Error {
  constructor() {
    super(RECOVERY_ERROR);
  }
}

async function browserCleanup<T>(operation: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new PushReconnectError()), 2000);
      }),
    ]);
  } catch {
    throw new PushReconnectError();
  } finally {
    clearTimeout(timer);
  }
}

/** Called only by the explicit enable/reconnect control. Never loops on failure. */
export async function registerDeviceForMember(
  registration: ServiceWorkerRegistration,
  subscribe: () => Promise<PushSubscriptionKeys>,
  register: (keys: PushSubscriptionKeys) => Promise<PushRegistrationResult>,
): Promise<void> {
  const original = await subscribe();
  const result = await register(original);
  if (result.ok) return;
  // Lost responses and generic authorization errors cannot prove ownership.
  if (result.reason !== "endpoint_owned") throw new Error(result.error);

  const current = await browserCleanup(() =>
    registration.pushManager.getSubscription(),
  );
  if (current) {
    if (current.endpoint !== original.endpoint) throw new PushReconnectError();
    const removed = await browserCleanup(() => current.unsubscribe());
    if (!removed) throw new PushReconnectError();
  }
  const replacement = await subscribe();
  if (replacement.endpoint === original.endpoint)
    throw new PushReconnectError();
  const retried = await register(replacement);
  // A fresh subscription is preserved if its registration response is uncertain.
  if (!retried.ok) throw new Error(retried.error);
}
