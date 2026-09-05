import fc from "fast-check";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: vi.fn(async () => ({ householdId: "household-one" })),
}));
const state = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: state.row, error: null }),
      };
      return query;
    },
  })),
}));
import { acknowledgeGroceryCreation } from "./creation-retry";
const input = {
  name: "Milk",
  quantity: "2",
  unit: "l",
  categoryId: null,
  note: null,
};
beforeEach(() => {
  state.row = {
    id: "one",
    name: "Milk",
    quantity: "2",
    unit: "l",
    category_id: null,
    note: null,
    state: "active",
  };
});
it.each(["active", "claimed"])(
  "acknowledges an unchanged %s addition",
  async (status) => {
    state.row!.state = status;
    await expect(acknowledgeGroceryCreation("one", input)).resolves.toEqual({
      id: "one",
    });
  },
);
it.each(["purchased", "removed"])(
  "does not recreate or report an old %s item as a fresh addition",
  async (status) => {
    state.row!.state = status;
    await expect(acknowledgeGroceryCreation("one", input)).rejects.toThrow(
      "changed details",
    );
  },
);
it("does not acknowledge a hidden collision", async () => {
  state.row = null;
  await expect(acknowledgeGroceryCreation("one", input)).rejects.toThrow(
    "changed details",
  );
});
it("never acknowledges a changed quantity on retry", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ maxLength: 80 }).filter((value) => value !== "2"),
      async (quantity) => {
        await expect(
          acknowledgeGroceryCreation("one", { ...input, quantity }),
        ).rejects.toThrow("changed details");
      },
    ),
    { numRuns: 50 },
  );
});
