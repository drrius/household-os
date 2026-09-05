import { z } from "zod";
import { uuid, type AiToolDefinition } from "./schemas";
export const notificationSchemas = {
  get_inbox: z.object({
    filter: z.enum(["all", "unread"]).default("all"),
    cursor: z
      .object({ createdAt: z.iso.datetime({ offset: true }).max(40), id: uuid })
      .nullable()
      .default(null),
  }),
  get_digest_preference: z.object({}),
  set_digest_preference: z.object({
    enabled: z.boolean(),
    localTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  }),
  mark_inbox_read: z.object({ notificationIds: z.array(uuid).min(1).max(40) }),
};
const descriptions = {
  get_inbox:
    "Read the signed-in member's inbox, actionable links and unread IDs. Use nextCursor for another page. Does not expose the partner's private inbox.",
  get_digest_preference:
    "Read the signed-in member's daily digest preference. Browser push enrollment and test notifications require the member's device at /home/notifications.",
  set_digest_preference:
    "Set the signed-in member's digest preference and local Europe/Zurich time (HH:mm). This does not enroll a browser for push; device enrollment requires /home/notifications.",
  mark_inbox_read:
    "Mark up to 40 notifications read for the signed-in member. Use actual IDs from get_inbox; never mark unseen messages unless the member explicitly requests that scope.",
};
export const NOTIFICATION_TOOLS: readonly AiToolDefinition[] = Object.entries(
  notificationSchemas,
).map(([name, inputSchema]) => ({
  name,
  inputSchema,
  kind: name.startsWith("get_") ? "read" : "write",
  description: descriptions[name as keyof typeof descriptions],
}));
