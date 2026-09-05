"use client";

import { useState, type FormEvent } from "react";

/** Keep edited values paired with their original concurrency version. */
export function useEditSnapshot<T>(
  data: T,
  values: Readonly<Record<string, string>>,
  creating: boolean,
) {
  const [snapshot, setSnapshot] = useState<{
    data: T;
    values: typeof values;
  } | null>(creating ? { data, values } : null);
  const current = snapshot ?? { data, values };
  function capture(event: FormEvent) {
    if (creating) return;
    const form =
      event.target instanceof Element ? event.target.closest("form") : null;
    if (!(form instanceof HTMLFormElement)) return;
    const submitted = new FormData(form);
    const dirty = Object.entries(current.values).some(
      ([name, value]) => submitted.has(name) && submitted.get(name) !== value,
    );
    setSnapshot(dirty ? current : null);
  }
  return {
    data: current.data,
    events: {
      onInput: capture,
      onChange: capture,
      onSubmitCapture: () => setSnapshot(current),
    },
  };
}
