import { SERVICE_WORKER_PATH } from "@/lib/auth/paths";

export { SERVICE_WORKER_PATH };

export type PushSubscriptionKeys = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushEnrollment =
  | { status: "unsupported" }
  | { status: "missing-vapid" }
  | { status: "needs-install" }
  | { status: "denied" }
  | { status: "needs-permission" }
  | { status: "unsubscribed" }
  | { status: "subscribed"; endpoint: string };

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = globalThis.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }
  return output;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const mediaStandalone = window.matchMedia(
    "(display-mode: standalone)",
  ).matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mediaStandalone || iosStandalone;
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /iPad|iPhone|iPod/u.test(navigator.userAgent);
}

export function pushApiSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function readVapidPublicKey(): string | null {
  const value = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function registerHouseholdServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(SERVICE_WORKER_PATH, {
    scope: "/",
    updateViaCache: "none",
  });
}

export async function detectPushEnrollment(
  registration: ServiceWorkerRegistration | null,
): Promise<PushEnrollment> {
  if (!pushApiSupported()) {
    return { status: "unsupported" };
  }
  if (!readVapidPublicKey()) {
    return { status: "missing-vapid" };
  }
  if (isIosDevice() && !isStandaloneDisplay()) {
    return { status: "needs-install" };
  }
  if (Notification.permission === "denied") {
    return { status: "denied" };
  }
  if (!registration) {
    return { status: "needs-permission" };
  }
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    return { status: "subscribed", endpoint: subscription.endpoint };
  }
  if (Notification.permission === "granted") {
    return { status: "unsubscribed" };
  }
  return { status: "needs-permission" };
}

export function serializePushSubscription(
  subscription: PushSubscription,
): PushSubscriptionKeys {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error("Push subscription is missing endpoint or keys");
  }
  return {
    endpoint: json.endpoint,
    p256dh,
    auth,
  };
}

export async function subscribeDevicePush(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscriptionKeys> {
  const vapidPublicKey = readVapidPublicKey();
  if (!vapidPublicKey) {
    throw new Error("VAPID public key is not configured");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted");
  }
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      vapidPublicKey,
    ) as BufferSource,
  });
  return serializePushSubscription(subscription);
}
