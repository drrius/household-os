"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { FormActionState } from "@/lib/forms/action-state";
import { leavesCurrentDocument } from "./discard-values";
import { registerHistoryGuard } from "./history-guard.client";
import { createDiscardControls } from "./discard-controls";

function plainClick(event: MouseEvent) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function useDiscardGuard(
  formRef: RefObject<HTMLFormElement | null>,
  enabled: boolean,
  submission: FormActionState,
  pending: boolean,
) {
  const guard = useRef<ReturnType<typeof createDiscardControls> | null>(null);
  const wasPending = useRef(false);
  useEffect(() => {
    if (!enabled || !formRef.current) return;
    const form = formRef.current;
    guard.current ??= createDiscardControls(form);
    const controls = guard.current;
    const dirty = () => controls.dirty();
    const unregisterHistory = registerHistoryGuard({
      dirty,
      pending: () => pending,
      discard: () => controls.discard(),
    });
    function click(event: MouseEvent) {
      if (!plainClick(event)) return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self") ||
        !leavesCurrentDocument(anchor.href, location.href)
      )
        return;
      if (pending) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (!dirty()) return;
      if (!window.confirm("Discard your unsaved changes?")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      } else if (formRef.current) {
        // The user explicitly authorized discarding this snapshot. This also
        // prevents a second browser-unload prompt for an ordinary anchor.
        controls.discard();
      }
    }
    function unload(event: BeforeUnloadEvent) {
      if (!pending && !dirty()) return;
      event.preventDefault();
      event.returnValue = "";
    }
    form.addEventListener("input", controls.input, true);
    form.addEventListener("change", controls.input, true);
    document.addEventListener("click", click, true);
    window.addEventListener("beforeunload", unload);
    return () => {
      unregisterHistory();
      form.removeEventListener("input", controls.input, true);
      form.removeEventListener("change", controls.input, true);
      document.removeEventListener("click", click, true);
      window.removeEventListener("beforeunload", unload);
    };
  }, [enabled, formRef, pending]);

  useEffect(() => {
    if (
      enabled &&
      wasPending.current &&
      !pending &&
      submission.error === undefined &&
      formRef.current
    ) {
      guard.current?.saved();
    }
    wasPending.current = pending;
  }, [enabled, formRef, pending, submission]);
}
