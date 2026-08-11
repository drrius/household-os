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

function isWatchedTable(value: string): value is WatchedTable {
  return (WATCHED_TABLES as readonly string[]).includes(value);
}

export function subscribeHouseholdSurfaces(
  input: SubscribeHouseholdSurfacesInput,
): () => void {
  const supabase = createClient();
  const dirty = new Set<AppSurface>();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (dirty.size === 0) {
      return;
    }
    const surfaces = [...dirty];
    dirty.clear();
    input.onDirty(surfaces);
  };

  const markDirty = (table: WatchedTable) => {
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

  let channel = supabase.channel(`household-surfaces:${input.householdId}`);
  for (const table of WATCHED_TABLES) {
    channel = channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `household_id=eq.${input.householdId}`,
      },
      (payload) => {
        const tableName = payload.table;
        if (typeof tableName === "string" && isWatchedTable(tableName)) {
          markDirty(tableName);
        }
      },
    );
  }

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      refreshAllWatched();
    }
  });

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      refreshAllWatched();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    document.removeEventListener("visibilitychange", onVisibility);
    void supabase.removeChannel(channel);
  };
}
