"use client";
import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

/** Refund previews submit derived allocations, so editing waits for their handlers. */
export function ReadyMoneyForm({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  return (
    <fieldset disabled={!ready} aria-busy={!ready} className="min-w-0">
      {children}
    </fieldset>
  );
}
