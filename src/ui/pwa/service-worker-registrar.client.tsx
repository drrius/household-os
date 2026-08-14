"use client";

import { useEffect } from "react";

import { registerHouseholdServiceWorker } from "@/lib/pwa/push-enrollment";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    void registerHouseholdServiceWorker().catch(() => {
      // Registration failures leave the online app usable; push stays optional.
    });
  }, []);

  return null;
}
