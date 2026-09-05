import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  member: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { cancelShoppingSessionAction } from "@/app/(product)/_actions/groceries";
describe("late shopping cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.member.mockResolvedValue({});
  });
  it("reports the completed purchase instead of resolving the cancellation as success", async () => {
    mocks.rpc.mockResolvedValue({
      error: { code: "55000", message: "shopping already completed" },
    });
    const data = new FormData();
    data.set("sessionId", "20000000-0000-4000-8000-000000000071");
    await expect(cancelShoppingSessionAction(data)).resolves.toBe("completed");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
