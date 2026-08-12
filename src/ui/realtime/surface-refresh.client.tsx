"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { AppSurface } from "@/domain/notifications/types";
import { subscribeHouseholdSurfaces } from "@/lib/realtime/surfaces";

export type SurfaceRefreshProps = {
  householdId: string;
  surface: AppSurface;
};

export function SurfaceRefresh({ householdId, surface }: SurfaceRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    return subscribeHouseholdSurfaces({
      householdId,
      onDirty(surfaces) {
        if (surfaces.includes(surface)) {
          router.refresh();
        }
      },
    });
  }, [householdId, router, surface]);

  return null;
}
