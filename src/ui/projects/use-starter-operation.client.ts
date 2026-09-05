"use client";

import { useEffect, useState } from "react";
import { z } from "zod";

/** Persist only retry identity, scoped to this tab and project; never task content. */
export function useStarterOperation(projectId: string) {
  const key = `household-os:starter-operation:${projectId}`;
  const [id, setId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try {
        const stored = sessionStorage.getItem(key);
        const operation = z.uuid().safeParse(stored).success
          ? stored!
          : crypto.randomUUID();
        sessionStorage.setItem(key, operation);
        setId(operation);
      } catch {
        setError(
          "This browser could not keep retry information. Allow browser storage, or add tasks individually from your checklist.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [key]);
  function confirm() {
    if (id === null) return;
    try {
      if (sessionStorage.getItem(key) === id) sessionStorage.removeItem(key);
    } catch {
      setError(
        "Your tasks were saved, but retry information could not be cleared. Allow browser storage before starting another selection.",
      );
    }
  }
  return { id, error, confirm };
}
