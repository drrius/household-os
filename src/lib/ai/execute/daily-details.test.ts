import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: vi.fn(async () => ({ householdId: "household-one" })),
}));
vi.mock("@/lib/household/commands", () => ({
  updateArea: vi.fn(),
  updatePet: vi.fn(),
  reorderAreas: vi.fn(),
}));
vi.mock("@/lib/meals/preparation", () => ({
  loadMealPreparation: vi.fn(),
  updateMealPreparation: vi.fn(),
}));
import {
  loadMealPreparation,
  updateMealPreparation,
} from "@/lib/meals/preparation";
import { reorderAreas } from "@/lib/household/commands";
import { DAILY_DETAIL_HANDLERS } from "./daily-details";
const id = "11111111-1111-4111-8111-111111111111";
const context = { idempotencyKey: "ai:prep:one", today: "2026-09-05" };
const input = {
  entryId: id,
  expectedUpdatedAt: "2026-09-05T10:00:00Z",
  originalDueOn: "2026-09-06",
  dueOn: "2026-09-07",
  title: "Prepare dinner",
  instructions: "Defrost",
  areaId: id,
  assignedMemberId: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadMealPreparation).mockResolvedValue({
    id,
    routine_id: id,
    due_date: "2026-09-08",
    status: "open",
    planned_assignee_id: null,
    routine: {
      updated_at: input.expectedUpdatedAt,
      title: input.title,
      instructions: "",
      area_id: id,
      schedule_rule: { kind: "one_off", date: "2026-09-06" },
    },
  });
});
it("edits from the routine schedule without confusing a rescheduled occurrence date", async () => {
  await DAILY_DETAIL_HANDLERS.update_meal_preparation!(input, context);
  const value = vi.mocked(updateMealPreparation).mock.calls[0]![0];
  expect(value).toMatchObject(input);
  expect(value.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
});
it("rejects a changed original schedule before applying an edit", async () => {
  await expect(
    DAILY_DETAIL_HANDLERS.update_meal_preparation!(
      { ...input, originalDueOn: "2026-09-08" },
      context,
    ),
  ).rejects.toThrow("schedule changed");
  expect(updateMealPreparation).not.toHaveBeenCalled();
});
it("does not overwrite a concurrent preparation edit", async () => {
  vi.mocked(updateMealPreparation).mockRejectedValueOnce(
    new Error("This prep task changed"),
  );
  await expect(
    DAILY_DETAIL_HANDLERS.update_meal_preparation!(input, context),
  ).rejects.toThrow("changed");
  expect(updateMealPreparation).toHaveBeenCalledTimes(1);
});
it("rejects duplicate IDs in a proposed area order", async () => {
  await expect(
    DAILY_DETAIL_HANDLERS.reorder_household_areas!({ ids: [id, id] }, context),
  ).rejects.toThrow("unique");
  expect(reorderAreas).not.toHaveBeenCalled();
});
