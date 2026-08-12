"use client";

import { usePathname } from "next/navigation";

import type { AppSurface } from "@/domain/notifications/types";
import { SurfaceRefresh } from "@/ui/realtime/surface-refresh.client";

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
  if (pathname === "/home" || pathname.startsWith("/home/")) {
    return "home";
  }
  return "today";
}

export type ProductSurfaceRefreshProps = {
  householdId: string;
};

export function ProductSurfaceRefresh({
  householdId,
}: ProductSurfaceRefreshProps) {
  const pathname = usePathname();
  return (
    <SurfaceRefresh
      householdId={householdId}
      surface={surfaceFromPath(pathname)}
    />
  );
}
