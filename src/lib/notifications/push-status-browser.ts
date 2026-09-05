"use client";

import {
  registerPushSubscriptionAction,
  unregisterPushSubscriptionAction,
} from "@/app/(product)/_actions/notifications";
import {
  enqueueDevicePushTestAction,
  readDevicePushTestAction,
  readPushRegistrationAction,
} from "@/app/(product)/_actions/push-status";
import {
  detectPushEnrollment,
  registerHouseholdServiceWorker,
  subscribeDevicePush,
  type PushEnrollment,
} from "@/lib/pwa/push-enrollment";
import type {
  PushStatusResult,
  PushTestStatus,
} from "@/lib/notifications/push-status-contract";

export type PushSetupEnrollment =
  | PushEnrollment
  | { status: "unregistered"; endpoint: string }
  | { status: "unavailable" };
export type PushSetupOperations = {
  current: () => Promise<PushSetupEnrollment>;
  enable: () => Promise<PushSetupEnrollment>;
  disable: (endpoint: string) => Promise<PushSetupEnrollment>;
  test: (input: {
    endpoint: string;
    requestId: string;
  }) => Promise<PushStatusResult<PushTestStatus>>;
  check: (input: {
    endpoint: string;
    requestId: string;
  }) => Promise<PushStatusResult<PushTestStatus>>;
};

export async function reconcilePushEnrollment(
  browser: PushEnrollment,
  read: typeof readPushRegistrationAction,
): Promise<PushSetupEnrollment> {
  if (browser.status !== "subscribed") return browser;
  const result = await read(browser.endpoint);
  if (!result.ok) throw new Error(result.error);
  return result.value.registered
    ? browser
    : { status: "unregistered", endpoint: browser.endpoint };
}

async function current(): Promise<PushSetupEnrollment> {
  if (!("serviceWorker" in navigator)) return { status: "unsupported" };
  const registration = await registerHouseholdServiceWorker();
  return reconcilePushEnrollment(
    await detectPushEnrollment(registration),
    readPushRegistrationAction,
  );
}

async function enable(): Promise<PushSetupEnrollment> {
  const registration = await registerHouseholdServiceWorker();
  const keys = await subscribeDevicePush(registration);
  const result = await registerPushSubscriptionAction({
    ...keys,
    userAgent: navigator.userAgent,
  });
  // Preserve the browser subscription on a lost response: registration may have
  // succeeded. Reconciliation and explicit reconnect safely recover either case.
  if (!result.ok) throw new Error(result.error);
  return current();
}

async function disable(endpoint: string): Promise<PushSetupEnrollment> {
  const result = await unregisterPushSubscriptionAction({ endpoint });
  if (!result.ok) throw new Error(result.error);
  const registration = await registerHouseholdServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  await subscription?.unsubscribe();
  return current();
}

export const pushSetupOperations: PushSetupOperations = {
  current,
  enable,
  disable,
  test: enqueueDevicePushTestAction,
  check: readDevicePushTestAction,
};
