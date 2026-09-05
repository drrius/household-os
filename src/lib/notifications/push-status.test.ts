import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ member: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { readPushRegistration, devicePushTest } from "./push-status";
import {
  pushEndpointSchema,
  pushTestRequestSchema,
} from "./push-status-contract";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.member.mockResolvedValue({ householdId: "home", userId: "member" });
});
describe("device registration boundary", () => {
  it.each([
    null,
    { id: "device", disabled_at: "2026-09-05" },
    { id: "device", disabled_at: null },
  ])("uses the exact member, household and endpoint: %j", async (data) => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    };
    const from = vi.fn().mockReturnValue(query);
    mocks.client.mockResolvedValue({ from });
    expect(await readPushRegistration("https://push.example/device")).toEqual({
      registered: data !== null && data.disabled_at === null,
    });
    expect(query.eq.mock.calls).toEqual([
      ["household_id", "home"],
      ["member_id", "member"],
      ["endpoint", "https://push.example/device"],
    ]);
    expect(query.select).toHaveBeenCalledWith("id, disabled_at");
  });
  it("does not read before authentication or confuse a read error with missing registration", async () => {
    mocks.member.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(
      readPushRegistration("https://push.example/device"),
    ).rejects.toThrow();
    expect(mocks.client).not.toHaveBeenCalled();
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "private backend detail" },
      }),
    };
    mocks.client.mockResolvedValue({ from: () => query });
    await expect(
      readPushRegistration("https://push.example/device"),
    ).rejects.toThrow("Could not check this device");
  });
  it.each([
    "javascript:alert(1)",
    "http://push.example",
    "https://user:password@push.example",
    "x".repeat(4001),
  ])("rejects invalid endpoint %s", (endpoint) => {
    expect(pushEndpointSchema.safeParse(endpoint).success).toBe(false);
  });
  it("rejects invalid request IDs and only accepts known safe status values", async () => {
    expect(
      pushTestRequestSchema.safeParse({
        endpoint: "https://push.example",
        requestId: "other or id",
      }).success,
    ).toBe(false);
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: "00000000-0000-4000-8000-000000000001",
        status: "accepted",
      },
      error: null,
    });
    mocks.client.mockResolvedValue({ rpc });
    await expect(
      devicePushTest("enqueue_self_device_push_test", {
        endpoint: "https://push.example",
        requestId: "00000000-0000-4000-8000-000000000001",
      }),
    ).resolves.toMatchObject({ status: "accepted" });
    expect(rpc).toHaveBeenCalledWith("enqueue_self_device_push_test", {
      p_endpoint: "https://push.example",
      p_request_id: "00000000-0000-4000-8000-000000000001",
    });
  });
});
