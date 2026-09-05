import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  occurrence: {} as Record<string, unknown>,
  filter: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not found");
  },
}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: async () => ({
    householdId: "f0000000-0000-4000-8000-000000000001",
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const result = {
        data:
          table === "routine_occurrences"
            ? mock.occurrence
            : table === "household_members"
              ? []
              : null,
        error: null,
      };
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => result,
        then: (resolve: (value: unknown) => void) =>
          Promise.resolve(result).then(resolve),
      };
      return query;
    },
  }),
}));
import { loadOccurrenceDetail } from "./occurrence-detail";
const id = "f0000000-0000-4000-8000-000000000001";
beforeEach(() => {
  mock.occurrence = {
    id,
    routine_id: id,
    due_date: "2026-09-05",
    original_due_date: "2026-09-05",
    status: "open",
    role: "current",
    planned_assignee_id: null,
    routine: {
      id,
      title: "Archived routine",
      instructions: null,
      paused_at: "2026-09-01",
      archived_at: "2026-09-04",
    },
  };
});
it("allows explicit closure of the archived current occurrence even if previously paused", async () => {
  expect((await loadOccurrenceDetail(id)).canAct).toBe(true);
});
it("keeps closed occurrences and previews non-actionable", async () => {
  mock.occurrence.status = "completed";
  expect((await loadOccurrenceDetail(id)).canAct).toBe(false);
  mock.occurrence.status = "open";
  mock.occurrence.role = "preview";
  expect((await loadOccurrenceDetail(id)).canAct).toBe(false);
});
