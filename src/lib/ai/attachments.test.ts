import fc from "fast-check";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: vi.fn(async () => ({
    householdId: "11111111-1111-4111-8111-111111111111",
  })),
}));
const mocks = vi.hoisted(() => ({ sign: vi.fn(), cleanup: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    storage: { from: () => ({ createSignedUrl: mocks.sign }) },
  })),
}));
vi.mock("@/lib/attachments/cleanup", () => ({
  cleanupAttachments: mocks.cleanup,
}));
import { readAttachmentTool, ATTACHMENT_HANDLERS } from "./attachments";
const path =
  "11111111-1111-4111-8111-111111111111/documents/22222222-2222-4222-8222-222222222222.pdf";
beforeEach(() => vi.resetAllMocks());
it("returns an app link without exposing the signed token or claiming to read contents", async () => {
  mocks.sign.mockResolvedValue({
    data: { signedUrl: "https://storage.invalid/SECRET-TOKEN" },
    error: null,
  });
  const result = await readAttachmentTool("get_attachment_link", { path });
  expect(result.contentsRead).toBe(false);
  expect(
    new URL(String(result.href), "https://app.invalid").searchParams.get(
      "path",
    ),
  ).toBe(path);
  expect(JSON.stringify(result)).not.toContain("SECRET");
});
it("rejects other households before attempting storage access", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.uuid().filter((id) => id.toLowerCase() !== path.split("/")[0]),
      async (householdId) => {
        await expect(
          readAttachmentTool("get_attachment_link", {
            path: `${householdId}/${path.split("/").slice(1).join("/")}`,
          }),
        ).rejects.toThrow("unavailable");
      },
    ),
    { numRuns: 30 },
  );
  expect(mocks.sign).not.toHaveBeenCalled();
});
it("does not return a link when storage rejects access", async () => {
  mocks.sign.mockResolvedValue({ data: null, error: { message: "denied" } });
  await expect(
    readAttachmentTool("get_attachment_link", { path }),
  ).rejects.toThrow("unavailable");
});
it("does not claim a failed cleanup finished", async () => {
  mocks.cleanup.mockResolvedValue(false);
  await expect(
    ATTACHMENT_HANDLERS.clean_unused_attachment!(
      { path },
      { idempotencyKey: "unused", today: "2026-09-05" },
    ),
  ).rejects.toThrow("Could not finish");
});
