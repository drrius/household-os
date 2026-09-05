import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { loadAttachmentUsage } from "./usage";
it("asks for the authenticated aggregate without tenant or object arguments", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: "500000000", error: null });
  expect(await loadAttachmentUsage({ rpc })).toMatchObject({
    warning: true,
    totalBytes: "500000000",
  });
  expect(rpc).toHaveBeenCalledExactlyOnceWith("household_attachment_usage");
});
it.each([
  { data: null, error: null },
  { data: 0, error: null },
  { data: "0", error: { message: "down" } },
])(
  "retains unknown state for malformed or failed response %j",
  async (result) => {
    expect(
      await loadAttachmentUsage({ rpc: vi.fn().mockResolvedValue(result) }),
    ).toEqual({ status: "unavailable" });
  },
);
it("handles transport failure without breaking the rest of Home", async () => {
  expect(
    await loadAttachmentUsage({
      rpc: vi.fn().mockRejectedValue(new Error("offline")),
    }),
  ).toEqual({ status: "unavailable" });
});
