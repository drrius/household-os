"use client";

import {
  SURFACE_INVALIDATION_MAP,
  surfacesForTableChange,
} from "@/domain/notifications/surfaces";
import type {
  AppSurface,
  HouseholdId,
  WatchedTable,
} from "@/domain/notifications/types";
import { createClient } from "@/lib/supabase/client";

const WATCHED_TABLES = Object.keys(SURFACE_INVALIDATION_MAP) as WatchedTable[];

export type SubscribeHouseholdSurfacesInput = {
  householdId: HouseholdId | string;
  onDirty: (surfaces: readonly AppSurface[]) => void;
};

export function subscribeHouseholdSurfaces(
  input: SubscribeHouseholdSurfacesInput,
): () => void {
  const supabase = createClient();
  const dirty = new Set<AppSurface>();
  let disposed = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (disposed || dirty.size === 0) {
      return;
    }
    const surfaces = [...dirty];
    dirty.clear();
    input.onDirty(surfaces);
  };

  const markDirty = (table: WatchedTable) => {
    if (disposed) return;
    for (const surface of surfacesForTableChange(table)) {
      dirty.add(surface);
    }
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(flush, 50);
  };

  const refreshAllWatched = () => {
    for (const table of WATCHED_TABLES) {
      markDirty(table);
    }
  };

  // Channel removal is asynchronous; a new listener must not reuse a closing channel.
  let channel = supabase.channel(
    `household-surfaces:${input.householdId}:${crypto.randomUUID()}`,
  );
  for (const table of WATCHED_TABLES) {
    channel = channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `household_id=eq.${input.householdId}`,
      },
      () => markDirty(table),
    );
  }

  let subscriptionStart: Promise<void> | null = null;
  const startSubscription = () => {
    if (disposed || subscriptionStart) return;
    // Cookie-backed session restoration may finish after the socket connects.
    subscriptionStart = supabase.realtime
      .setAuth()
      .then(() => {
        if (disposed) return;
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") refreshAllWatched();
        });
      })
      .catch(() => {
        // A later visibility change can retry transient auth initialization.
        subscriptionStart = null;
      });
  };
  startSubscription();

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      startSubscription();
      refreshAllWatched();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    disposed = true;
    dirty.clear();
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    document.removeEventListener("visibilitychange", onVisibility);
    void supabase.removeChannel(channel);
  };
}
