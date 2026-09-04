import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  member: vi.fn(),
  info: vi.fn(),
  read: vi.fn(),
  complete: vi.fn(),
  skip: vi.fn(),
  reschedule: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/routines/commands", () => ({
  completeOccurrence: mocks.complete,
  skipOccurrence: mocks.skip,
  rescheduleOccurrence: mocks.reschedule,
}));
vi.mock("@/lib/money/commands", () => ({ confirmExpenseDraft: vi.fn() }));
vi.mock("@/lib/ui/zurich-date", () => ({
  zurichCivilDate: () => "2026-09-05",
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    storage: { from: () => ({ info: mocks.info }) },
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: mocks.read }) }),
      }),
    }),
  }),
}));

import { updateOccurrenceAction } from "./routines";

const householdId = "f1000000-0000-4000-8000-000000000001";
const occurrenceId = "f0000000-0000-4000-8000-000000000001";
function form(intent: string) {
  const data = new FormData();
  data.set("occurrenceId", occurrenceId);
  data.set("intent", intent);
  data.set("idempotencyKey", "f0000000-0000-4000-8000-000000000002");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.member.mockResolvedValue({ householdId });
  mocks.info.mockResolvedValue({
    data: { metadata: { mimetype: "image/jpeg" } },
    error: null,
  });
  mocks.read.mockResolvedValue({
    data: { due_date: "2026-09-05" },
    error: null,
  });
});

describe("routine detail server actions", () => {
  it("uses server civil date and the independent submitted completion key", async () => {
    const data = form("complete");
    data.set("completedOn", "2099-12-31");
    data.set("note", "  Water bowl filled  ");
    await updateOccurrenceAction({ submissionId: 0 }, data);
    expect(mocks.complete).toHaveBeenCalledWith({
      occurrenceId,
      idempotencyKey: data.get("idempotencyKey"),
      completedOn: "2026-09-05",
      note: "Water bowl filled",
      photoPath: null,
    });
  });
  it("rejects a forged cross-household photo path before any completion", async () => {
    const data = form("complete");
    data.set(
      "photoPath",
      "f1000000-0000-4000-8000-000000000002/completions/f0000000-0000-4000-8000-000000000009.jpg",
    );
    const result = await updateOccurrenceAction({ submissionId: 0 }, data);
    expect(result.error).toBe(
      "Choose a completion photo uploaded to this household.",
    );
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("preserves a valid photo and the note on retryable command failure", async () => {
    const data = form("complete");
    const path = `${householdId}/completions/f0000000-0000-4000-8000-000000000009.jpg`;
    data.set("photoPath", path);
    data.set("note", "Blue lead is in the hallway");
    mocks.complete.mockRejectedValueOnce(
      new Error("complete_occurrence failed: unavailable"),
    );
    const result = await updateOccurrenceAction({ submissionId: 2 }, data);
    expect(result.values).toMatchObject({
      photoPath: path,
      note: "Blue lead is in the hallway",
    });
    expect(result.submissionId).toBe(3);
  });
  it("reschedules one occurrence and never changes its routine definition", async () => {
    const data = form("reschedule");
    data.set("newDueDate", "2026-09-08");
    await updateOccurrenceAction({ submissionId: 0 }, data);
    expect(mocks.reschedule).toHaveBeenCalledWith({
      occurrenceId,
      newDueDate: "2026-09-08",
      idempotencyKey: data.get("idempotencyKey"),
    });
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.skip).not.toHaveBeenCalled();
  });
});

it("keeps a distinct completion attempt distinct when the occurrence was already closed", async () => {
  const first = form("complete");
  await updateOccurrenceAction({ submissionId: 0 }, first);
  const second = form("complete");
  second.set("idempotencyKey", "f0000000-0000-4000-8000-000000000003");
  second.set("note", "Different member's note");
  mocks.complete.mockRejectedValueOnce(new Error("Occurrence already closed"));
  const rejected = await updateOccurrenceAction({ submissionId: 0 }, second);
  expect(rejected.error).toBe("Occurrence already closed");
  expect(rejected.values).toMatchObject({
    note: "Different member's note",
    idempotencyKey: second.get("idempotencyKey"),
  });
  expect(mocks.complete).toHaveBeenLastCalledWith(
    expect.objectContaining({ idempotencyKey: second.get("idempotencyKey") }),
  );
});
it("puts unchanged-date errors on the reschedule field before calling the RPC", async () => {
  const input = form("reschedule");
  input.set("newDueDate", "2026-09-05");
  expect(
    await updateOccurrenceAction({ submissionId: 0 }, input),
  ).toMatchObject({
    field: "newDueDate",
    error: "Choose a different date from the current due date.",
  });
  expect(mocks.reschedule).not.toHaveBeenCalled();
});
