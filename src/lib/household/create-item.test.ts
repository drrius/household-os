import fc from "fast-check";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: vi.fn(async () => ({ householdId: "household" })),
}));
const state = vi.hoisted(() => ({
  previous: null as Record<string, unknown> | null,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => {
      const query = {
        insert: () => query,
        select: () => query,
        eq: () => query,
        single: async () => ({ data: null, error: { code: "23505" } }),
        maybeSingle: async () => ({ data: state.previous, error: null }),
      };
      return query;
    },
  })),
}));
import { createHouseholdItem } from "./create-item";
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  state.previous = { id, name: "Kitchen", archived_at: null };
});
it.each(["areas", "pets"] as const)(
  "acknowledges an unchanged %s creation retry",
  async (table) => {
    await expect(createHouseholdItem(table, "Kitchen", id)).resolves.toEqual({
      id,
    });
  },
);
it("rejects renamed records instead of creating another item", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc
        .string({ minLength: 1, maxLength: 80 })
        .filter((name) => name !== "Kitchen"),
      async (name) => {
        await expect(createHouseholdItem("areas", name, id)).rejects.toThrow(
          "Could not confirm",
        );
      },
    ),
    { numRuns: 30 },
  );
});
it("rejects a hidden collision", async () => {
  state.previous = null;
  await expect(createHouseholdItem("pets", "Kitchen", id)).rejects.toThrow(
    "Could not confirm",
  );
});
