import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function subscribeToViewport(callback: () => void) {
  const mediaQuery = window.matchMedia(
    `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
  );
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getViewportSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function getServerSnapshot() {
  return false;
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribeToViewport,
    getViewportSnapshot,
    getServerSnapshot,
  );
}
