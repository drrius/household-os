import "server-only";
import { upsertDigestPreference } from "@/lib/notifications/commands";
import { markInboxPageRead } from "@/lib/notifications/inbox-commands";
import { notificationSchemas } from "../definitions/notification-tools";
import type { AiWriteHandler } from "./types";
export const NOTIFICATION_HANDLERS: Record<string, AiWriteHandler> = {
  set_digest_preference: (input) =>
    upsertDigestPreference(
      notificationSchemas.set_digest_preference.parse(input),
    ),
  mark_inbox_read: async (input) => {
    const { notificationIds } =
      notificationSchemas.mark_inbox_read.parse(input);
    await markInboxPageRead(notificationIds);
    return { done: true };
  },
};
