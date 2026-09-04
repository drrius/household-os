"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  signOutThisDevice,
  type SignOutResult,
} from "@/app/security/sign-out-action";

export function SignOutControl({
  action = signOutThisDevice,
}: {
  action?: (endpoint: string | null) => Promise<SignOutResult>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endpointRef = useRef<string | null>(null);
  async function signOut() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      let subscription: PushSubscription | null | undefined;
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        subscription = await registration?.pushManager?.getSubscription();
        if (subscription) {
          endpointRef.current = subscription.endpoint;
        }
      }
      const result = await action(endpointRef.current);
      if (!result.ok) throw new Error(result.error);
      // The server has already disabled delivery and ended the session.
      // Browser cleanup must not hold sign-out hostage to a push-service failure.
      void subscription?.unsubscribe().catch(() => undefined);
      // A full navigation discards this tab's authenticated router state.
      window.location.replace("/sign-in");
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
        End this browser’s session and turn off its push notifications. Your
        passkeys and other signed-in devices stay available.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
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
