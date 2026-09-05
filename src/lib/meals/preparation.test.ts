import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  member: vi.fn(),
  client: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { updateMealPreparation } from "@/lib/meals/preparation";
const id = "11111111-1111-4111-8111-111111111111";
const input = {
  entryId: id,
  expectedUpdatedAt: "2026-09-05T12:00:00.123456+00:00",
  idempotencyKey: id,
  originalDueOn: "2030-08-08",
  title: "Prep",
  instructions: "Thaw first",
  areaId: id,
  assignedMemberId: null,
  dueOn: "2030-08-08",
};
function database(status = "open") {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      error: null,
      data: {
        id,
        routine_id: id,
        due_date: "2030-08-08",
        status,
        planned_assignee_id: null,
        routine: {
          updated_at: "2026-09-05T12:00:00.987654+00:00",
          title: "Prep",
          instructions: null,
          area_id: id,
          schedule_rule: { kind: "one_off", date: "2030-08-06" },
        },
      },
    }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mocks.client.mockResolvedValue({ from: () => query, rpc: mocks.rpc });
  return query;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.member.mockResolvedValue({ householdId: id });
  mocks.rpc.mockResolvedValue({ error: null });
});
describe("linked preparation editor", () => {
  it("keeps a rescheduled one-off anchor when editing text without moving the date", async () => {
    const query = database();
    await updateMealPreparation(input);
    expect(query.eq).toHaveBeenCalledWith("household_id", id);
    expect(query.eq).toHaveBeenCalledWith("meal_plan_entry_id", id);
    expect(mocks.rpc.mock.calls[0]?.[1].p_patch).not.toHaveProperty(
      "schedule_rule",
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "edit_routine_definition",
      expect.objectContaining({
        p_expected_updated_at: input.expectedUpdatedAt,
        p_idempotency_key: input.idempotencyKey,
      }),
    );
  });
  it("passes an intentional new due date and never requests recurrence", async () => {
    database();
    await updateMealPreparation({ ...input, dueOn: "2030-08-09" });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "edit_routine_definition",
      expect.objectContaining({
        p_patch: expect.objectContaining({
          schedule_kind: "one_off",
          schedule_rule: { kind: "one_off", date: "2030-08-09" },
        }),
      }),
    );
  });
  it("edits closed task text without changing its historical schedule or assignment", async () => {
    database("completed");
    await updateMealPreparation(input);
    const sent = mocks.rpc.mock.calls[0]?.[1].p_patch;
    expect(sent).not.toHaveProperty("schedule_rule");
    expect(sent).toHaveProperty("assignment_policy", "shared");
    expect(sent).toHaveProperty("title", "Prep");
  });
  it("does not silently discard a changed date when completion races saving", async () => {
    database("completed");
    mocks.rpc.mockResolvedValue({ error: { code: "55000" } });
    await expect(
      updateMealPreparation({ ...input, dueOn: "2030-08-09" }),
    ).rejects.toThrow("Could not update this prep task");
    expect(mocks.rpc.mock.calls[0]?.[1].p_patch.schedule_rule).toEqual({
      kind: "one_off",
      date: "2030-08-09",
    });
  });
  it("preserves the submitted version and reports a stale conflict", async () => {
    database();
    mocks.rpc.mockResolvedValue({ error: { code: "40001" } });
    await expect(updateMealPreparation(input)).rejects.toThrow(
      "This prep task changed. Reopen it before saving.",
    );
    expect(mocks.rpc.mock.calls[0]?.[1].p_expected_updated_at).toBe(
      input.expectedUpdatedAt,
    );
  });
  it("requires membership before reading the linked task", async () => {
    mocks.member.mockRejectedValue(new Error("Sign in"));
    await expect(updateMealPreparation(input)).rejects.toThrow("Sign in");
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
