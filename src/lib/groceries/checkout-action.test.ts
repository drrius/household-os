import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  finish: vi.fn(),
  member: vi.fn(),
  options: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/forms/options", () => ({ loadMoneyFormOptions: mocks.options }));
vi.mock("@/lib/groceries/commands", () => ({
  finishShoppingSession: mocks.finish,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: mocks.redirect,
}));
import { finishShoppingCheckoutAction } from "@/app/(product)/_actions/groceries";

const homeId = "10000000-0000-4000-8000-000000000001";
const viewerId = "00000000-0000-4000-8000-000000000001";
const partnerId = "00000000-0000-4000-8000-000000000002";
const sessionId = "20000000-0000-4000-8000-000000000001";
function checkout(path = "") {
  const form = new FormData();
  for (const [name, value] of Object.entries({
    sessionId,
    occurredOn: "2026-09-05",
    receiptTotal: "104.80",
    receiptPath: path,
    createExpenseDraft: "on",
    amount: "80.01",
    description: "Coop groceries",
    payerMemberId: viewerId,
    splitMode: "equal",
    idempotencyKey: "30000000-0000-4000-8000-000000000001",
  }))
    form.set(name, value);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.member.mockResolvedValue({ householdId: homeId, userId: viewerId });
  mocks.options.mockResolvedValue({
    members: [{ user_id: viewerId }, { user_id: partnerId }],
  });
  mocks.finish.mockResolvedValue({ shopping_session_id: sessionId });
  mocks.redirect.mockImplementation((href: string) => {
    throw new Error(`redirect:${href}`);
  });
});

describe("finish shopping action", () => {
  it("validates shared allocation and authorizes receipt paths before invoking the transaction", async () => {
    const receiptPath = `${homeId}/receipts/40000000-0000-4000-8000-000000000001.jpg`;
    await expect(
      finishShoppingCheckoutAction({ submissionId: 0 }, checkout(receiptPath)),
    ).rejects.toThrow(`redirect:/groceries/shopping/${sessionId}`);
    expect(mocks.finish).toHaveBeenCalledWith(
      expect.objectContaining({
        shoppingSessionId: sessionId,
        receiptPath,
        receiptTotalCents: 10480,
        sharedAmountCents: 8001,
        payerMemberId: viewerId,
        proposedAllocations: [
          { memberId: viewerId, allocatedCents: 4001 },
          { memberId: partnerId, allocatedCents: 4000 },
        ],
      }),
    );
    expect(mocks.revalidate).toHaveBeenCalledWith("/money");
  });

  it("rejects foreign-household and external receipt paths without finishing the cart", async () => {
    for (const path of [
      "https://example.com/receipt.pdf",
      `${homeId}/completions/40000000-0000-4000-8000-000000000001.jpg`,
      `${homeId}/documents/40000000-0000-4000-8000-000000000001.pdf`,
      "10000000-0000-4000-8000-000000000002/receipts/40000000-0000-4000-8000-000000000001.pdf",
    ]) {
      const result = await finishShoppingCheckoutAction(
        { submissionId: 0 },
        checkout(path),
      );
      expect(result.error).toContain("this household");
      expect(result.values?.amount).toBe("80.01");
    }
    expect(mocks.finish).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("retains checkout inputs on a transactional failure", async () => {
    mocks.finish.mockRejectedValue(
      new Error("finish_shopping_session failed: stale session"),
    );
    const result = await finishShoppingCheckoutAction(
      { submissionId: 4 },
      checkout(),
    );
    expect(result.submissionId).toBe(5);
    expect(result.error).toBeTruthy();
    expect(result.values?.receiptTotal).toBe("104.80");
    expect(result.values?.createExpenseDraft).toBe("on");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
