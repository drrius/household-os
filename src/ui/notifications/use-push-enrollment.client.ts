"use client";

import { useEffect, useState } from "react";

import {
  registerPushSubscriptionAction,
  unregisterPushSubscriptionAction,
} from "@/app/(product)/_actions/notifications";
import {
  detectPushEnrollment,
  registerHouseholdServiceWorker,
  subscribeDevicePush,
  type PushEnrollment,
} from "@/lib/pwa/push-enrollment";

async function currentEnrollment(): Promise<PushEnrollment> {
  if (!("serviceWorker" in navigator)) {
    return { status: "unsupported" };
  }
  const registration = await registerHouseholdServiceWorker();
  return detectPushEnrollment(registration);
}

async function enablePush(): Promise<PushEnrollment> {
  const registration = await registerHouseholdServiceWorker();
  const keys = await subscribeDevicePush(registration);
  const result = await registerPushSubscriptionAction({
    ...keys,
    userAgent: navigator.userAgent,
  });
  if (!result.ok) {
    const subscription = await registration.pushManager.getSubscription();
    await subscription?.unsubscribe();
    throw new Error(result.error);
  }
  return { status: "subscribed", endpoint: keys.endpoint };
}

async function disablePush(endpoint: string): Promise<PushEnrollment> {
  const registration = await registerHouseholdServiceWorker();
  const result = await unregisterPushSubscriptionAction({ endpoint });
  if (!result.ok) {
    throw new Error(result.error);
  }
  const subscription = await registration.pushManager.getSubscription();
  await subscription?.unsubscribe();
  return detectPushEnrollment(registration);
}

export function usePushEnrollment() {
  const [enrollment, setEnrollment] = useState<PushEnrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void currentEnrollment()
      .then((next) => {
        if (!cancelled) setEnrollment(next);
      })
      .catch(() => {
        if (!cancelled) setEnrollment({ status: "unsupported" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function subscribe() {
    if (pending) return;
    setError(null);
    setPending(true);
    void enablePush()
      .then(setEnrollment)
      .catch((failure: unknown) => {
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not enable push on this device.",
        );
        void currentEnrollment().then(setEnrollment);
      })
      .finally(() => {
        setPending(false);
      });
  }

  function unsubscribe() {
    if (pending || enrollment?.status !== "subscribed") return;
    const endpoint = enrollment.endpoint;
    setError(null);
    setPending(true);
    void disablePush(endpoint)
      .then(setEnrollment)
      .catch((failure: unknown) => {
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not disable push on this device.",
        );
        void currentEnrollment().then(setEnrollment);
      })
      .finally(() => {
        setPending(false);
      });
  }

  return { enrollment, error, pending, subscribe, unsubscribe };
}
