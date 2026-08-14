"use client";

import { useSyncExternalStore } from "react";

import { isIosDevice, isStandaloneDisplay } from "@/lib/pwa/push-enrollment";

function subscribeDisplayMode(onStoreChange: () => void): () => void {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function readInstallPromptState(): { show: boolean; ios: boolean } {
  return {
    show: !isStandaloneDisplay(),
    ios: isIosDevice(),
  };
}

const serverSnapshot = { show: false, ios: false };

export function InstallGuidance() {
  const { show, ios } = useSyncExternalStore(
    subscribeDisplayMode,
    readInstallPromptState,
    () => serverSnapshot,
  );

  if (!show) {
    return null;
  }

  return (
    <section
      aria-label="Install Household OS"
      className="grid gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3"
    >
      <h3 className="font-heading text-base font-bold">Install on this device</h3>
      {ios ? (
        <p className="text-sm text-muted-foreground">
          On iPhone or iPad, open the Share menu and choose Add to Home Screen.
          Push alerts only work after the app is installed.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your browser can install Household OS when the manifest and HTTPS
          checks pass. Look for the install control in the address bar or browser
          menu.
        </p>
      )}
    </section>
  );
}
