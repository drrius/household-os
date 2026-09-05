"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { listPasskeys, PasskeyManager } from "./passkey-manager";
import type { PasskeySummary } from "@/lib/auth/passkeys";

export function PasskeyLoader({
  load = listPasskeys,
}: {
  load?: () => Promise<PasskeySummary[]>;
}) {
  const [passkeys, setPasskeys] = useState<PasskeySummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(load)
      .then(
        (value) => {
          if (active) setPasskeys(value);
        },
        () => {
          if (active) setFailed(true);
        },
      );
    return () => {
      active = false;
    };
  }, [load, attempt]);
  if (failed)
    return (
      <section className="grid gap-3" aria-label="Passkey availability">
        <p role="alert">
          Your passkeys could not load. You can still sign out of this device.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setFailed(false);
            setAttempt(attempt + 1);
          }}
        >
          Retry loading passkeys
        </Button>
      </section>
    );
  if (passkeys === null)
    return <p role="status">Loading passkeys… You can still sign out below.</p>;
  return <PasskeyManager initialPasskeys={passkeys} />;
}
