import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ member: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { saveHouseholdRecord } from "./records";

function database(result: unknown, prior?: unknown) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(prior ?? result),
    insert: vi.fn().mockResolvedValue(result),
  };
  const client = { from: vi.fn().mockReturnValue(chain) };
  mocks.client.mockResolvedValue(client);
  return chain;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.member.mockResolvedValue({ householdId: "our-home", userId: "actor" });
});

it("authenticates before accessing records", async () => {
  mocks.member.mockRejectedValue(new Error("Sign in"));
  await expect(
    saveHouseholdRecord("household_projects", "id", {}, null),
  ).rejects.toThrow("Sign in");
  expect(mocks.client).not.toHaveBeenCalled();
});

it("requires the current household and expected version when saving edits", async () => {
  const query = database({ data: { id: "project" }, error: null });
  await saveHouseholdRecord(
    "household_projects",
    "project",
    { title: "Our plan" },
    "version",
  );
  expect(query.eq.mock.calls).toEqual([
    ["household_id", "our-home"],
    ["id", "project"],
    ["updated_at", "version"],
  ]);
});

it("does not overwrite an edit from another session", async () => {
  database({ data: null, error: null });
  await expect(
    saveHouseholdRecord(
      "household_projects",
      "project",
      { title: "Old edit" },
      "old-version",
    ),
  ).rejects.toThrow("changed since");
});

it("takes creation identity from the authenticated context", async () => {
  const query = database({ error: null });
  await saveHouseholdRecord(
    "household_projects",
    "project",
    {
      title: "Our plan",
      household_id: "forged",
      created_by: "forged",
      id: "forged",
    },
    null,
  );
  expect(query.insert).toHaveBeenCalledWith({
    id: "project",
    household_id: "our-home",
    created_by: "actor",
    title: "Our plan",
  });
});

it("recognizes a retried creation only when the saved payload matches", async () => {
  const query = database(
    { error: { code: "23505" } },
    { data: { title: "Our plan" }, error: null },
  );
  await expect(
    saveHouseholdRecord(
      "household_projects",
      "project",
      { title: "Our plan" },
      null,
    ),
  ).resolves.toBeUndefined();
  expect(query.eq).toHaveBeenCalledWith("household_id", "our-home");
  await expect(
    saveHouseholdRecord(
      "household_projects",
      "project",
      { title: "Different plan" },
      null,
    ),
  ).rejects.toThrow("Couldn't create");
});

it("does not treat an inaccessible colliding ID as a successful retry", async () => {
  database({ error: { code: "23505" } }, { data: null, error: null });
  await expect(
    saveHouseholdRecord(
      "household_projects",
      "project",
      { title: "Our plan" },
      null,
    ),
  ).rejects.toThrow("Couldn't create");
});

it.each([null, "previous-version"])(
  "explains an archived parent rejected atomically during task save (%s)",
  async (version) => {
    database({ data: null, error: { code: "55000" } });
    await expect(
      saveHouseholdRecord(
        "project_tasks",
        "task",
        { title: "Late edit" },
        version,
      ),
    ).rejects.toThrow("Restore this plan");
  },
);
