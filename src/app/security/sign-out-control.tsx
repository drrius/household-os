"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  signOutThisDevice,
  type SignOutResult,
} from "@/app/security/sign-out-action";

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager?.getSubscription()) ?? null;
}

/** Browser discovery is optional; neither a rejection nor a stalled API delays sign-out indefinitely. */
export async function discoverSignOutSubscription(): Promise<PushSubscription | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      currentSubscription().catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 500);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function subscribeReadiness() {
  return () => {};
}

export function SignOutControl({
  action = signOutThisDevice,
}: {
  action?: (endpoint: string | null) => Promise<SignOutResult>;
}) {
  const ready = useSyncExternalStore(
    subscribeReadiness,
    () => true,
    () => false,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pushPausedRef = useRef(false);
  const endpointRef = useRef<string | null>(null);
  async function signOut() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const subscription = await discoverSignOutSubscription();
      if (subscription) endpointRef.current = subscription.endpoint;
      const result = await action(endpointRef.current);
      pushPausedRef.current ||= result.pushPaused === true;
      if (!result.ok) throw new Error(result.error);
      // The server has ended the session and paused this endpoint or the member’s push fallback.
      // Browser cleanup must not hold sign-out hostage to a push-service failure.
      if (result.unsubscribe)
        void Promise.resolve()
          .then(() => subscription?.unsubscribe())
          .catch(() => undefined);
      // A full navigation discards this tab's authenticated router state.
      window.location.replace(
        pushPausedRef.current ? "/sign-in?push=paused" : "/sign-in",
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not sign out. Try again.",
      );
      setPending(false);
    }
  }
  return (
    <section
      aria-labelledby="sign-out-title"
      className="grid gap-3 border-t pt-6"
    >
      <h2 id="sign-out-title" className="font-heading text-lg font-semibold">
        This device
      </h2>
      <p className="text-base text-muted-foreground">
        End this browser’s session. Your passkeys and other signed-in devices
        stay available. If this browser cannot identify its notifications,
        signing out pauses push on all of your devices. Reconnect them in
        Notifications after signing in.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={!ready || pending}
        onClick={() => void signOut()}
      >
        {pending ? "Signing out…" : "Sign out of this device"}
      </Button>
      {error ? (
        <p role="alert" className="text-base text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
