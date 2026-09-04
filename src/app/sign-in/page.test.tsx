import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  member: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/member-context", () => ({
  getVerifiedIdentity: mocks.identity,
  getMemberContext: mocks.member,
}));
vi.mock("@/app/sign-in/sign-in-form", () => ({ SignInForm: () => null }));
import SignInPage from "./page";

describe("sign-in route membership continuation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.identity.mockResolvedValue({ userId: "member" });
    mocks.member.mockResolvedValue({ householdId: "household" });
    mocks.redirect.mockImplementation((path) => {
      throw new Error(`redirect:${path}`);
    });
  });
  it("returns an already authenticated member to the intended record", async () => {
    await expect(
      SignInPage({
        searchParams: Promise.resolve({
          returnTo: "/money/events/123#history",
        }),
      }),
    ).rejects.toThrow("redirect:/money/events/123#history");
  });
  it("keeps authenticated non-members at access denied regardless of return path", async () => {
    mocks.member.mockResolvedValue(null);
    await expect(
      SignInPage({ searchParams: Promise.resolve({ returnTo: "/home" }) }),
    ).rejects.toThrow("redirect:/access-denied");
  });
  it("discards hostile destinations even for already authenticated members", async () => {
    await expect(
      SignInPage({
        searchParams: Promise.resolve({ returnTo: "//evil.invalid" }),
      }),
    ).rejects.toThrow("redirect:/");
  });
});
