"use client";

import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const WELCOME_DISMISSED_KEY = "household-os:welcome-dismissed";
const WELCOME_DISMISSED_VALUE = "1";
const WELCOME_CHANGE_EVENT = "household-os:welcome-change";

let dismissedThisSession = false;

function readDismissed(): boolean {
  if (dismissedThisSession) {
    return true;
  }

  try {
    return (
      localStorage.getItem(WELCOME_DISMISSED_KEY) === WELCOME_DISMISSED_VALUE
    );
  } catch {
    return false;
  }
}

function persistDismissed(): void {
  dismissedThisSession = true;
  try {
    localStorage.setItem(WELCOME_DISMISSED_KEY, WELCOME_DISMISSED_VALUE);
  } catch {
    // Session dismiss still stands when storage is blocked.
  }
  window.dispatchEvent(new Event(WELCOME_CHANGE_EVENT));
}

function subscribeWelcome(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(WELCOME_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(WELCOME_CHANGE_EVENT, onStoreChange);
  };
}

export function FirstVisitWelcome() {
  const dismissed = useSyncExternalStore(
    subscribeWelcome,
    readDismissed,
    () => true,
  );

  return (
    <Dialog
      open={!dismissed}
      onOpenChange={(open) => {
        if (!open) {
          persistDismissed();
        }
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Welcome to your household</DialogTitle>
          <DialogDescription>
            Plan meals, share groceries, keep routines moving, and settle money
            in one place. Both of you, equally.
          </DialogDescription>
        </DialogHeader>
        <Button onClick={persistDismissed} size="lg" type="button">
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}
