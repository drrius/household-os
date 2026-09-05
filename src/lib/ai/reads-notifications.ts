import "server-only";
import {
  loadDigestPreference,
  loadInboxPage,
} from "@/lib/read-models/notifications";
import { notificationSchemas } from "./definitions/notification-tools";
export async function readNotificationTool(
  name: string,
  input: unknown,
): Promise<Record<string, unknown>> {
  if (name === "get_digest_preference")
    return {
      preference: await loadDigestPreference(),
      deviceSetupPath: "/home/notifications",
    };
  return loadInboxPage(notificationSchemas.get_inbox.parse(input));
}
