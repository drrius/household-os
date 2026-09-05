import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/notifications/commands", () => ({
  upsertDigestPreference: vi.fn(async () => ({})),
}));
vi.mock("@/lib/notifications/inbox-commands", () => ({
  markInboxPageRead: vi.fn(),
}));
import { upsertDigestPreference } from "@/lib/notifications/commands";
import { markInboxPageRead } from "@/lib/notifications/inbox-commands";
import { NOTIFICATION_HANDLERS } from "./notifications";
const context = { idempotencyKey: "ai:inbox:one", today: "2026-09-05" };
beforeEach(() => vi.clearAllMocks());
it.each(["24:00", "12:60", "8:00"])(
  "rejects invalid digest time %s",
  (time) => {
    expect(() =>
      NOTIFICATION_HANDLERS.set_digest_preference!(
        { enabled: true, localTime: time },
        context,
      ),
    ).toThrow();
    expect(upsertDigestPreference).not.toHaveBeenCalled();
  },
);
it("does not claim success when the current member cannot mark selected messages", async () => {
  vi.mocked(markInboxPageRead).mockRejectedValueOnce(
    new Error("This inbox page changed"),
  );
  await expect(
    NOTIFICATION_HANDLERS.mark_inbox_read!(
      { notificationIds: ["11111111-1111-4111-8111-111111111111"] },
      context,
    ),
  ).rejects.toThrow("changed");
});
