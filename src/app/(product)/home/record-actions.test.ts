import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  member: vi.fn(),
  archive: vi.fn(),
  save: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mock.member,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mock.redirect }));
vi.mock("@/lib/home-records/commands", () => ({
  archiveRecord: mock.archive,
  saveRecord: mock.save,
  chooseOption: vi.fn(),
  convertDecision: vi.fn(),
  setDecisionStatus: vi.fn(),
}));
import { recordAction } from "./record-actions";
const signal = new Error("NEXT_REDIRECT");
beforeEach(() => {
  vi.resetAllMocks();
  mock.member.mockResolvedValue({ householdId: "household" });
  mock.save.mockResolvedValue("saved-id");
  mock.redirect.mockImplementation(() => {
    throw signal;
  });
});
it("lets expired-session redirects escape form-error handling", async () => {
  mock.member.mockRejectedValue(signal);
  await expect(recordAction({ submissionId: 0 }, new FormData())).rejects.toBe(
    signal,
  );
  expect(mock.archive).not.toHaveBeenCalled();
  expect(mock.save).not.toHaveBeenCalled();
});
it.each([
  ["contacts", "contacts"],
  ["documents", "documents"],
  ["options", "decisions"],
  ["maintenance", "inventory"],
])("keeps %s lifecycle fallback in the %s section", async (kind, section) => {
  const form = new FormData();
  form.set("kind", kind);
  form.set("intent", "archive");
  form.set("id", "id");
  form.set("version", "version");
  form.set("returnTo", "https://example.com");
  await expect(recordAction({ submissionId: 0 }, form)).rejects.toBe(signal);
  expect(mock.redirect).toHaveBeenCalledWith(`/home/${section}?saved=1`);
  expect(mock.archive).toHaveBeenCalledWith(kind, "id", "version", false);
});
