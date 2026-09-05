import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ claims: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: mocks.claims } }),
}));
import { proxy } from "@/proxy";

describe("protected request continuation", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-public-key");
    mocks.claims.mockResolvedValue({ data: { claims: null } });
  });
  it("encodes a protected path and its query as one sign-in parameter", async () => {
    const response = await proxy(
      new NextRequest(
        "https://app.example.invalid/plan?week=2026-09-07&day=2026-09-09",
      ),
    );
    const redirect = new URL(response.headers.get("location")!);
    expect(redirect.pathname).toBe("/sign-in");
    expect(redirect.searchParams.get("returnTo")).toBe(
      "/plan?week=2026-09-07&day=2026-09-09",
    );
    expect([...redirect.searchParams.keys()]).toEqual(["returnTo"]);
  });
  it("does not create an auth loop for public sign-in", async () => {
    const response = await proxy(
      new NextRequest("https://app.example.invalid/sign-in?returnTo=/home"),
    );
    expect(response.headers.get("location")).toBeNull();
  });
  it("passes authenticated protected requests through unchanged", async () => {
    mocks.claims.mockResolvedValue({ data: { claims: { sub: "member" } } });
    const response = await proxy(
      new NextRequest("https://app.example.invalid/home"),
    );
    expect(response.headers.get("location")).toBeNull();
  });
});
