import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ member: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import {
  enqueueDevicePushTestAction,
  readDevicePushTestAction,
  readPushRegistrationAction,
} from "./push-status";

const endpoint = "https://push.example/device";
const input = { endpoint, requestId: "f49a1e50-610c-4903-b1e6-9890bb2d742c" };
const commands = [
  ["registration", () => readPushRegistrationAction(endpoint)],
  ["enqueue", () => enqueueDevicePushTestAction(input)],
  ["delivery status", () => readDevicePushTestAction(input)],
] as const;

beforeEach(() => vi.resetAllMocks());
describe.each(commands)("push %s recovery", (_name, command) => {
  it.each(["/sign-in", "/access-denied"])(
    "preserves the actual %s redirect",
    async (destination) => {
      mocks.member.mockImplementation(() => redirect(destination));
      await expect(command()).rejects.toMatchObject({
        digest: expect.stringContaining(`;${destination};`),
      });
      expect(mocks.client).not.toHaveBeenCalled();
    },
  );
  it("still returns a recoverable result for an operational failure", async () => {
    mocks.member.mockRejectedValue(new Error("private backend details"));
    const result = await command();
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      error: expect.stringMatching(/try again/i),
    });
    expect(JSON.stringify(result)).not.toContain("private backend details");
  });
});
