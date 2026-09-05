"use client";

import { useEffect, useRef, useState } from "react";
import {
  pushSetupOperations,
  type PushSetupEnrollment,
  type PushSetupOperations,
} from "@/lib/notifications/push-status-browser";
import { PushReconnectError } from "@/lib/notifications/push-registration-recovery";
import type { PushTestStatus } from "@/lib/notifications/push-status-contract";

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Could not update this device. Try again.";
}

export function usePushEnrollment(
  operations: PushSetupOperations = pushSetupOperations,
) {
  const [enrollment, setEnrollment] = useState<PushSetupEnrollment | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void operations
      .current()
      .then((next) => {
        if (!cancelled) setEnrollment(next);
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setEnrollment({ status: "unavailable" });
          setError(message(failure));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [operations]);

  async function run(operation: () => Promise<PushSetupEnrollment>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      setEnrollment(await operation());
    } catch (failure) {
      setError(message(failure));
      // Ownership was conclusively rejected; repeating the stalled browser
      // lookup here would hide the recovery error behind an endless spinner.
      if (!(failure instanceof PushReconnectError)) {
        try {
          setEnrollment(await operations.current());
        } catch {
          setEnrollment({ status: "unavailable" });
        }
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return {
    enrollment,
    error,
    pending,
    refresh: () => {
      void run(operations.current);
    },
    subscribe: () => {
      void run(operations.enable);
    },
    unsubscribe: () => {
      if (enrollment && "endpoint" in enrollment) {
        const endpoint = enrollment.endpoint;
        void run(() => operations.disable(endpoint));
      }
    },
  };
}

export function useDevicePushTest(
  endpoint: string,
  operations: PushSetupOperations,
) {
  const [test, setTest] = useState<PushTestStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const request = useRef<string | null>(null);
  const busy = useRef(false);
  async function run(check: boolean) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    // Retry uncertain enqueue responses with the same UUID, not a second job.
    request.current ??= crypto.randomUUID();
    try {
      const result = await (check ? operations.check : operations.test)({
        endpoint,
        requestId: request.current,
      });
      if (!result.ok) throw new Error(result.error);
      setTest(result.value);
    } catch (failure) {
      setError(message(failure));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return {
    test,
    error,
    pending,
    send: () => {
      void run(false);
    },
    check: () => {
      void run(true);
    },
    reset: () => {
      request.current = null;
      setTest(null);
      setError(null);
    },
  };
}
