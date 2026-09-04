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
    expect(mocks.rpc).toHaveBeenCalledWith(
      "update_routine_definition",
      expect.objectContaining({
        p_schedule_kind: "one_off",
        p_schedule_rule: { kind: "one_off", date: "2030-08-06" },
      }),
    );
  });
  it("passes an intentional new due date and never requests recurrence", async () => {
    database();
    await updateMealPreparation({ ...input, dueOn: "2030-08-09" });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "update_routine_definition",
      expect.objectContaining({
        p_schedule_kind: "one_off",
        p_schedule_rule: { kind: "one_off", date: "2030-08-09" },
      }),
    );
  });
  it("edits closed task text without changing its historical schedule or assignment", async () => {
    database("completed");
    await updateMealPreparation(input);
    const sent = mocks.rpc.mock.calls[0]?.[1];
    expect(sent).not.toHaveProperty("p_schedule_rule");
    expect(sent).not.toHaveProperty("p_assignment_policy");
    expect(sent).toHaveProperty("p_title", "Prep");
  });
  it("requires membership before reading the linked task", async () => {
    mocks.member.mockRejectedValue(new Error("Sign in"));
    await expect(updateMealPreparation(input)).rejects.toThrow("Sign in");
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
