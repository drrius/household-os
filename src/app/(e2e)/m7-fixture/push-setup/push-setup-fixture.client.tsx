"use client";
import { useMemo, useState } from "react";
import type {
  PushSetupEnrollment,
  PushSetupOperations,
} from "@/lib/notifications/push-status-browser";
import { PushEnrollmentPanel } from "@/ui/notifications/push-enrollment-panel.client";

function fixtureOperations(
  state: string,
  log: (text: string) => void,
): PushSetupOperations & { restoreConnection: () => void } {
  let current: PushSetupEnrollment = {
    status:
      state === "enabled" || state === "test-error" || state === "test-failed"
        ? "subscribed"
        : "unregistered",
    endpoint: "https://push.example/fixture",
  };
  let connectionAvailable = state !== "status-error";
  let enableAttempts = 0;
  let tests = 0;
  const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 250));
  return {
    restoreConnection() {
      connectionAvailable = true;
    },
    async current() {
      if (!connectionAvailable) throw new Error("Connection lost. Try again.");
      if (state === "denied") return { status: "denied" };
      return current;
    },
    async enable() {
      log("enable");
      await pause();
      enableAttempts += 1;
      if (state === "enable-error" && enableAttempts === 1)
        throw new Error("Registration failed. Try again.");
      current = {
        status: "subscribed",
        endpoint: "https://push.example/fixture",
      };
      return current;
    },
    async disable() {
      log("disable");
      await pause();
      current = {
        status: "unregistered",
        endpoint: "https://push.example/fixture",
      };
      return current;
    },
    async test({ requestId }) {
      log(`test:${requestId}`);
      await pause();
      tests += 1;
      if (state === "test-error" && tests === 1)
        throw new Error("Response lost. Retry safely.");
      return { ok: true, value: { id: requestId, status: "queued" } };
    },
    async check({ requestId }) {
      log(`check:${requestId}`);
      await pause();
      return {
        ok: true,
        value: {
          id: requestId,
          status: state === "test-failed" ? "failed" : "accepted",
        },
      };
    },
  };
}

export function PushSetupFixture({ state }: { state: string }) {
  const [calls, setCalls] = useState<string[]>([]);
  const operations = useMemo(
    () =>
      fixtureOperations(state, (text) =>
        setCalls((previous) => [...previous, text]),
      ),
    [state],
  );
  return (
    <>
      <PushEnrollmentPanel operations={operations} />
      {state === "status-error" ? (
        <button type="button" onClick={operations.restoreConnection}>
          Restore fixture connection
        </button>
      ) : null}
      <output className="sr-only" data-testid="fixture-calls">
        {calls.join("\n")}
      </output>
    </>
  );
}
