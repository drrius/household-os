import { beforeEach, expect, it, vi } from "vitest";
import { parseRecord } from "@/domain/home-records/schema";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  member: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  result: vi.fn(),
  select: vi.fn(),
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
    select: mock.select,
    maybeSingle: mock.result,
    update: mock.update,
    insert: mock.insert,
  };
  mock.from.mockReturnValue(query);
  mock.select.mockReturnValue(query);
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
  mock.result.mockResolvedValueOnce({
    data: {
      id,
      archived_at: null,
      ...parseRecord("inventory", Object.fromEntries(input)),
    },
    error: null,
  });
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
  expect(mock.rpc).toHaveBeenCalledWith(
    "archive_household_decision_option_versioned",
    {
      p_option_id: id,
      p_archived: true,
      p_version: "version",
    },
  );
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

it.each([
  { title: "Partner changed the title" },
  { notes: "Partner added care instructions" },
  { contact_id: household },
  { archived_at: "2026-09-05T12:00:00Z" },
])(
  "rejects creation collisions with changed existing details %j without updating",
  async (changes) => {
    const input = form();
    const existing = {
      id,
      archived_at: null,
      ...parseRecord("inventory", Object.fromEntries(input)),
      ...changes,
    };
    mock.insert.mockResolvedValueOnce({ error: { code: "23505" } });
    mock.result.mockResolvedValueOnce({ data: existing, error: null });
    await expect(saveRecord("inventory", input)).rejects.toThrow(
      "Your changes were not saved",
    );
    expect(mock.eq).toHaveBeenCalledWith("household_id", household);
    expect(mock.eq).toHaveBeenCalledWith("id", id);
    expect(mock.update).not.toHaveBeenCalled();
    expect(existing).toMatchObject(changes);
    expect(input.get("title")).toBe("Dishwasher");
  },
);
it.each([
  { data: null, error: null },
  { data: null, error: { code: "08006" } },
  { data: { id }, error: { code: "42501" } },
])(
  "does not claim success for missing, foreign or failed collision lookup %j",
  async (lookup) => {
    mock.insert.mockResolvedValueOnce({ error: { code: "23505" } });
    mock.result.mockResolvedValueOnce(lookup);
    await expect(saveRecord("inventory", form())).rejects.toThrow(
      "Couldn't save",
    );
    expect(mock.update).not.toHaveBeenCalled();
  },
);
it("does not acknowledge a different routine-link unique constraint as the submitted ID", async () => {
  const input = form();
  input.set("asset_id", household);
  input.set("routine_id", id);
  mock.insert.mockResolvedValueOnce({
    error: { code: "23505", details: "household_id,asset_id,routine_id" },
  });
  mock.result.mockResolvedValueOnce({ data: null, error: null });
  await expect(saveRecord("routines", input)).rejects.toThrow("Couldn't save");
  expect(mock.update).not.toHaveBeenCalled();
});

it.each([false, true])(
  "compares chosen=%s before acknowledging an option retry",
  async (chosen) => {
    const input = form();
    input.set("decision_id", household);
    const existing = {
      id,
      archived_at: null,
      ...parseRecord("options", Object.fromEntries(input)),
      chosen,
    };
    mock.insert.mockResolvedValueOnce({ error: { code: "23505" } });
    mock.result.mockResolvedValueOnce({ data: existing, error: null });
    const result = saveRecord("options", input);
    if (chosen)
      await expect(result).rejects.toThrow("Your changes were not saved");
    else await expect(result).resolves.toBe(id);
    expect(mock.select).toHaveBeenCalledWith(expect.stringContaining("chosen"));
    expect(mock.update).not.toHaveBeenCalled();
  },
);

it("explains how to recover a choice or status blocked by an archived decision", async () => {
  mock.rpc.mockResolvedValue({ error: { code: "55000" } });
  await expect(chooseOption(id, id)).rejects.toThrow(
    "Restore this decision before changing its choice.",
  );
  await expect(setDecisionStatus(id, "considering")).rejects.toThrow(
    "Restore this decision before changing its status.",
  );
});

it("passes the opened option version and reports stale archive attempts", async () => {
  mock.rpc.mockResolvedValue({ error: { code: "40001" } });
  await expect(
    archiveRecord("options", id, "2026-09-05T12:00:00.123456Z", true),
  ).rejects.toThrow("Reload and try again");
  expect(mock.rpc).toHaveBeenCalledWith(
    "archive_household_decision_option_versioned",
    {
      p_option_id: id,
      p_archived: false,
      p_version: "2026-09-05T12:00:00.123456Z",
    },
  );
});
