import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  member: vi.fn(),
  members: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  unstable_rethrow: (failure: Error) => {
    if (failure.message.startsWith("redirect:")) throw failure;
  },
}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/connected/context-expense-command", () => ({
  postContextualExpense: mocks.post,
}));
vi.mock("@/app/(product)/_actions/m7-shared", () => ({
  loadHouseholdMembers: mocks.members,
  revalidateProduct: mocks.refresh,
}));
import { postContextExpenseAction } from "@/app/(product)/money/contexts/actions";
const id = "00000000-0000-4000-8000-000000000001",
  partner = "00000000-0000-4000-8000-000000000002";
const target = { kind: "project" as const, id, bookingId: partner };
function form() {
  const value = new FormData();
  for (const [key, content] of Object.entries({
    description: "Hotel",
    amount: "125.01",
    payerMemberId: id,
    occurredOn: "2026-09-05",
    splitMode: "equal",
    idempotencyKey: id,
  }))
    value.set(key, content);
  return value;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.member.mockResolvedValue({ userId: id, householdId: id });
  mocks.members.mockResolvedValue([{ user_id: id }, { user_id: partner }]);
  mocks.post.mockResolvedValue({ eventId: id });
});
it("posts the exact split and booking once, then redirects within its context", async () => {
  await expect(
    postContextExpenseAction(target, { submissionId: 0 }, form()),
  ).rejects.toThrow("redirect:/money/contexts/project/");
  expect(mocks.post).toHaveBeenCalledWith(
    expect.objectContaining({
      amountCents: 12501,
      contextKind: "project",
      contextId: id,
      bookingId: partner,
      allocations: [
        { memberId: id, allocatedCents: 6251 },
        { memberId: partner, allocatedCents: 6250 },
      ],
    }),
  );
  expect(mocks.post).toHaveBeenCalledTimes(1);
  expect(mocks.redirect).toHaveBeenCalledWith(
    `/money/contexts/project/${id}?booking=${partner}&saved=1`,
  );
});
it("retains input and does not redirect after an uncertain posting response", async () => {
  mocks.post.mockRejectedValueOnce(new Error("Retry the same details."));
  const result = await postContextExpenseAction(
    target,
    { submissionId: 2 },
    form(),
  );
  expect(result).toMatchObject({
    error: "Retry the same details.",
    submissionId: 3,
    values: { amount: "125.01", description: "Hotel" },
  });
  expect(mocks.redirect).not.toHaveBeenCalled();
  expect(mocks.refresh).not.toHaveBeenCalled();
});
it("rejects a forged receipt or context before invoking the mutation", async () => {
  const value = form();
  value.set("receiptPath", `${partner}/receipts/${id}.jpg`);
  expect(
    await postContextExpenseAction(target, { submissionId: 0 }, value),
  ).toHaveProperty("error");
  expect(mocks.post).not.toHaveBeenCalled();
  expect(
    await postContextExpenseAction(
      { ...target, kind: "asset" },
      { submissionId: 0 },
      form(),
    ),
  ).toHaveProperty("error");
});
it("preserves authentication redirects instead of turning them into form errors", async () => {
  mocks.member.mockRejectedValueOnce(new Error("redirect:/login"));
  await expect(
    postContextExpenseAction(target, { submissionId: 0 }, form()),
  ).rejects.toThrow("redirect:/login");
  expect(mocks.post).not.toHaveBeenCalled();
});
