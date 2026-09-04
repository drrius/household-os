import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  member: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  result: vi.fn(),
}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mock.member,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: mock.from, rpc: mock.rpc }),
}));
import {
  archiveRecord,
  chooseOption,
  convertDecision,
  saveRecord,
  setDecisionStatus,
} from "./commands";
const id = "f0000000-0000-4000-8000-000000000001";
const household = "f1000000-0000-4000-8000-000000000001";
function form() {
  const input = new FormData();
  input.set("id", id);
  input.set("title", "Dishwasher");
  return input;
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.member.mockResolvedValue({ householdId: household, userId: id });
  const query = {
    eq: mock.eq,
    select: () => query,
    maybeSingle: mock.result,
    update: mock.update,
    insert: mock.insert,
  };
  mock.from.mockReturnValue(query);
  mock.eq.mockReturnValue(query);
  mock.update.mockReturnValue(query);
  mock.insert.mockResolvedValue({ error: null });
  mock.result.mockResolvedValue({ data: { id }, error: null });
  mock.rpc.mockResolvedValue({ data: id, error: null });
});
it("writes only validated fields with the authorized household and creator", async () => {
  const input = form();
  input.set("household_id", "another");
  await saveRecord("inventory", input);
  expect(mock.insert).toHaveBeenCalledWith(
    expect.objectContaining({
      household_id: household,
      created_by: id,
      title: "Dishwasher",
    }),
  );
});
it("does not erase concurrent edits and preserves creation retries", async () => {
  const input = form();
  input.set("version", "2026-09-05T12:00:00Z");
  mock.result.mockResolvedValueOnce({ data: null, error: null });
  await expect(saveRecord("inventory", input)).rejects.toThrow(
    "record changed",
  );
  expect(mock.eq).toHaveBeenCalledWith("updated_at", "2026-09-05T12:00:00Z");
  input.delete("version");
  mock.insert.mockResolvedValueOnce({ error: { code: "23505" } });
  await expect(saveRecord("inventory", input)).resolves.toBe(id);
  expect(mock.update).toHaveBeenCalledTimes(1);
});
it("rejects a foreign attachment path before persisting", async () => {
  const input = form();
  input.set("file_path", `${id}/documents/${id}.pdf`);
  await expect(saveRecord("documents", input)).rejects.toMatchObject({
    field: "file_path",
  });
  expect(mock.insert).not.toHaveBeenCalled();
});
it("uses atomic commands for choices, option lifecycle, status and conversion", async () => {
  await chooseOption(id, id);
  await archiveRecord("options", id, "version", false);
  await setDecisionStatus(id, "dismissed");
  await convertDecision(id, "trip");
  expect(mock.rpc).toHaveBeenCalledWith("choose_household_decision_option", {
    p_decision_id: id,
    p_option_id: id,
  });
  expect(mock.rpc).toHaveBeenCalledWith("archive_household_decision_option", {
    p_option_id: id,
    p_archived: true,
  });
  expect(mock.rpc).toHaveBeenCalledWith("set_household_decision_status", {
    p_decision_id: id,
    p_status: "dismissed",
  });
  expect(mock.rpc).toHaveBeenCalledWith("convert_household_decision", {
    p_decision_id: id,
    p_kind: "trip",
  });
  expect(mock.update).not.toHaveBeenCalled();
});
it("authenticates even apparently harmless lifecycle actions", async () => {
  mock.member.mockRejectedValue(new Error("Sign in"));
  await expect(archiveRecord("contacts", id, "version", true)).rejects.toThrow(
    "Sign in",
  );
  expect(mock.from).not.toHaveBeenCalled();
});
