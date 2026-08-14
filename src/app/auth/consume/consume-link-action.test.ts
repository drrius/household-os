import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      verifyOtp: mocks.verifyOtp,
    },
  }),
}));

import { consumeMagicLink } from "@/app/auth/consume/consume-link-action";

describe("consumeMagicLink", () => {
  beforeEach(() => {
    mocks.redirect.mockReset();
    mocks.verifyOtp.mockReset();
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
  });

  it("rejects malformed submissions without contacting Supabase", async () => {
    await expect(consumeMagicLink(new FormData())).rejects.toThrow(
      "redirect:/auth/error?reason=malformed",
    );
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("exchanges the token only after submission and continues to Security", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: null });
    const formData = new FormData();
    formData.set("token_hash", "one-time-token");
    formData.set("type", "magiclink");

    await expect(consumeMagicLink(formData)).rejects.toThrow(
      "redirect:/security",
    );
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: "one-time-token",
      type: "email",
    });
  });

  it("sends rejected or expired tokens to the existing error gate", async () => {
    mocks.verifyOtp.mockResolvedValue({
      error: new Error("Token has expired or is invalid"),
    });
    const formData = new FormData();
    formData.set("token_hash", "expired-token");
    formData.set("type", "magiclink");

    await expect(consumeMagicLink(formData)).rejects.toThrow(
      "redirect:/auth/error?reason=rejected",
    );
  });
});
