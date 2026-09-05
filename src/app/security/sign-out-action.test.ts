import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  member: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: mocks.rpc,
    auth: { signOut: mocks.signOut },
  }),
}));
import { signOutThisDevice } from "./sign-out-action";

describe("sign out this device", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.member.mockResolvedValue({ userId: "member" });
    mocks.rpc.mockImplementation(async (name: string) => ({
      data: { disabled: name === "unregister_push_subscription" ? 1 : 0 },
      error: null,
    }));
    mocks.signOut.mockResolvedValue({ error: null });
  });
  it("disables only the submitted device subscription before ending the local session and invalidating all product routes", async () => {
    expect(
      await signOutThisDevice("https://push.example.invalid/current-device"),
    ).toEqual({ ok: true, unsubscribe: true });
    expect(mocks.rpc).toHaveBeenCalledWith("unregister_push_subscription", {
      p_endpoint: "https://push.example.invalid/current-device",
    });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.member.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.rpc.mock.invocationCallOrder[0]!,
    );
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0]!,
    );
    expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
  });
  it("works without push support or enrollment", async () => {
    expect(await signOutThisDevice(null)).toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith("pause_my_push_for_signout");
  });
  it("pauses the member's unidentified subscriptions before sign-out and reports the fallback", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { disabled: 2 },
      error: null,
    });
    expect(await signOutThisDevice(null)).toEqual({
      ok: true,
      pushPaused: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("pause_my_push_for_signout");
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0]!,
    );
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "unavailable" },
    });
    mocks.signOut.mockClear();
    expect((await signOutThisDevice(null)).ok).toBe(false);
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("requires membership before any subscription or session mutation", async () => {
    mocks.member.mockRejectedValue(new Error("not a member"));
    await expect(
      signOutThisDevice("https://push.example.invalid/device"),
    ).rejects.toThrow("not a member");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("does not accept unbounded or malformed endpoint input", async () => {
    expect((await signOutThisDevice("x".repeat(4001))).ok).toBe(false);
    expect((await signOutThisDevice(123 as unknown as string)).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("allows retry without claiming sign-out when notification cleanup or auth fails", async () => {
    mocks.rpc.mockResolvedValueOnce({
      error: { message: "private backend detail" },
    });
    expect(await signOutThisDevice("device")).toEqual({
      ok: false,
      error:
        "Could not turn off this device’s notifications. Try signing out again.",
    });
    expect(mocks.signOut).not.toHaveBeenCalled();
    mocks.signOut.mockResolvedValueOnce({
      error: { message: "private auth detail" },
    });
    expect((await signOutThisDevice("device")).ok).toBe(false);
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(await signOutThisDevice("device")).toEqual({
      ok: true,
      unsubscribe: true,
    });
  });

  it("returns actual fallback effects even when authentication fails", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { disabled: 2 },
      error: null,
    });
    mocks.signOut.mockResolvedValueOnce({ error: { message: "temporary" } });
    expect(await signOutThisDevice(null)).toEqual({
      ok: false,
      pushPaused: true,
      error: "Could not sign out. Check your connection and try again.",
    });
    mocks.rpc.mockResolvedValueOnce({
      data: { disabled: 0 },
      error: null,
    });
    mocks.signOut.mockResolvedValueOnce({ error: null });
    expect(await signOutThisDevice(null)).toEqual({ ok: true });
  });
  it("does not authorize browser cleanup when the endpoint was not owned", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { disabled: 0 }, error: null });
    mocks.signOut.mockResolvedValueOnce({ error: null });
    expect(
      await signOutThisDevice("https://push.example.invalid/partner"),
    ).toEqual({ ok: true });
  });
});
