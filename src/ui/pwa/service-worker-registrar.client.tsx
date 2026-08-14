"use client";

import { useEffect } from "react";

import { registerOptionalHouseholdServiceWorker } from "@/lib/pwa/push-enrollment";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    void registerOptionalHouseholdServiceWorker();
  }, []);

  return null;
}
