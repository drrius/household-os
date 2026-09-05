import fc from "fast-check";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: vi.fn(async () => ({ householdId: "household" })),
}));
const state = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => {
      const query = {
        insert: async () => ({ error: { code: "23505" } }),
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: state.row, error: null }),
      };
      return query;
    },
  })),
}));
import { createGroceryCategory } from "./category-create";
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  state.row = { name: "Produce", sort_order: 2, archived_at: null };
});
it("acknowledges an unchanged creation retry", async () => {
  await expect(
    createGroceryCategory("Produce", 2, id),
  ).resolves.toBeUndefined();
});
it("never overwrites a changed category on creation retry", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 3, max: 2147483647 }),
      async (sortOrder) => {
        await expect(
          createGroceryCategory("Produce", sortOrder, id),
        ).rejects.toThrow("Could not save");
      },
    ),
    { numRuns: 30 },
  );
});
it("does not acknowledge a hidden collision", async () => {
  state.row = null;
  await expect(createGroceryCategory("Produce", 2, id)).rejects.toThrow(
    "Could not save",
  );
});
