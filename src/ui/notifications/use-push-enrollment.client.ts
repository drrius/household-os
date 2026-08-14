"use client";

import { useEffect, useState, useTransition } from "react";

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
    throw new Error(result.error);
  }
  return { status: "subscribed", endpoint: keys.endpoint };
}

async function disablePush(endpoint: string): Promise<PushEnrollment> {
  const registration = await registerHouseholdServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  await subscription?.unsubscribe();
  const result = await unregisterPushSubscriptionAction({ endpoint });
  if (!result.ok) {
    throw new Error(result.error);
  }
  return detectPushEnrollment(registration);
}

export function usePushEnrollment() {
  const [enrollment, setEnrollment] = useState<PushEnrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
    setError(null);
    startTransition(() => {
      void enablePush()
        .then(setEnrollment)
        .catch((failure: unknown) => {
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not enable push on this device.",
          );
          void currentEnrollment().then(setEnrollment);
        });
    });
  }

  function unsubscribe() {
    if (enrollment?.status !== "subscribed") return;
    const endpoint = enrollment.endpoint;
    setError(null);
    startTransition(() => {
      void disablePush(endpoint)
        .then(setEnrollment)
        .catch((failure: unknown) => {
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not disable push on this device.",
          );
        });
    });
  }

  return { enrollment, error, pending, subscribe, unsubscribe };
}
