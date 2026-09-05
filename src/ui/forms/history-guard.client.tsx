"use client";

import { useEffect } from "react";
import { leavesCurrentDocument } from "./discard-values";

type Guard = {
  dirty: () => boolean;
  pending: () => boolean;
  discard: () => void;
};
const guards = new Set<Guard>();
const marker = "__householdHistoryIndex";
let installed = false;

function entryIndex(state: unknown): number | null {
  if (!state || typeof state !== "object") return null;
  const index = (state as Record<string, unknown>)[marker];
  return typeof index === "number" && Number.isSafeInteger(index)
    ? index
    : null;
}
function marked(state: unknown, index: number) {
  return {
    ...(state && typeof state === "object" ? state : {}),
    [marker]: index,
  };
}

function permitsLeaving() {
  if ([...guards].some((guard) => guard.pending())) return false;
  const dirty = [...guards].filter((guard) => guard.dirty());
  if (!dirty.length) return true;
  if (!window.confirm("Discard your unsaved changes?")) return false;
  dirty.forEach((guard) => guard.discard());
  return true;
}

function installHistoryGuard() {
  if (installed) return;
  installed = true;
  let current = entryIndex(history.state) ?? 0;
  let currentHref = location.href;
  let restoring = false;
  const push = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);
  replace(marked(history.state, current), "");
  history.pushState = (state, unused, url) => {
    push(marked(state, current + 1), unused, url);
    current++;
    currentHref = location.href;
  };
  history.replaceState = (state, unused, url) => {
    replace(marked(state, current), unused, url);
    currentHref = location.href;
  };
  // Capture precedes the App Router's bubble listener, keeping its tree intact
  // while a cancelled traversal returns to the existing entry. No sentinel
  // entries are added and Next's own history state is preserved.
  window.addEventListener(
    "popstate",
    (event) => {
      const target = entryIndex(event.state);
      if (restoring) {
        event.stopImmediatePropagation();
        if (target === current) restoring = false;
        else if (target !== null) history.go(current - target);
        return;
      }
      if (
        target !== null &&
        target !== current &&
        leavesCurrentDocument(location.href, currentHref) &&
        !permitsLeaving()
      ) {
        event.stopImmediatePropagation();
        restoring = true;
        history.go(current - target);
        return;
      }
      if (target !== null) current = target;
      currentHref = location.href;
    },
    true,
  );
}

export function registerHistoryGuard(guard: Guard) {
  installHistoryGuard();
  guards.add(guard);
  return () => {
    guards.delete(guard);
  };
}

export function HistoryGuard() {
  useEffect(() => {
    installHistoryGuard();
  }, []);
  return null;
}
