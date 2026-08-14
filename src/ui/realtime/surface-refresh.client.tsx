"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import type { AppSurface } from "@/domain/notifications/types";
import { subscribeHouseholdSurfaces } from "@/lib/realtime/surfaces";

function surfaceFromPath(pathname: string): AppSurface {
  if (pathname === "/plan" || pathname.startsWith("/plan/")) {
    return "plan";
  }
  if (pathname === "/groceries" || pathname.startsWith("/groceries/")) {
    return "groceries";
  }
  if (pathname === "/money" || pathname.startsWith("/money/")) {
    return "money";
  }
  if (
    pathname === "/home/inbox" ||
    pathname.startsWith("/home/inbox/") ||
    pathname === "/home/notifications" ||
    pathname.startsWith("/home/notifications/")
  ) {
    return "inbox";
  }
  if (pathname === "/home" || pathname.startsWith("/home/")) {
    return "home";
  }
  return "today";
}

type SurfaceRefreshProps = {
  householdId: string;
  surface?: AppSurface;
};

export function SurfaceRefresh({
  householdId,
  surface: surfaceProp,
}: SurfaceRefreshProps) {
  const pathname = usePathname();
  const router = useRouter();
  const surface = surfaceProp ?? surfaceFromPath(pathname);

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
