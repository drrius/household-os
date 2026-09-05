import "server-only";
import { appleCalendarUrl, calendarObjectUrl } from "./apple-url";
import type { CalendarCredentials } from "./credentials";
import { CalendarError } from "./errors";

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
export type CaldavResponse = {
  status: number;
  body: string;
  etag: string | null;
  url: string;
};
export type CaldavRequest = {
  url: string;
  method: "PROPFIND" | "REPORT" | "GET" | "PUT" | "DELETE";
  body?: string;
  headers?: Record<string, string>;
  calendarUrl?: string;
};
export type CaldavTransport = (
  request: CaldavRequest,
) => Promise<CaldavResponse>;

async function boundedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.byteLength;
    if (length > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new CalendarError(
        "size",
        "This calendar is too large to sync safely in one request. Choose a smaller shared calendar.",
      );
    }
    chunks.push(chunk.value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
function authorizeStatus(status: number) {
  if (status === 401)
    throw new CalendarError(
      "authentication",
      "iCloud rejected this connection. Reconnect with a current app-specific password.",
    );
  if (status === 403)
    throw new CalendarError(
      "permission",
      "This Apple Account does not have permission for that calendar action.",
    );
  if (status === 429 || status >= 500)
    throw new CalendarError(
      "network",
      "iCloud is temporarily unavailable. Try syncing again later.",
    );
}
export function createCaldavTransport(
  credentials: CalendarCredentials,
  requestFetch: typeof fetch = fetch,
  deadline = Date.now() + 45000,
): CaldavTransport {
  return async (request) => {
    let url = appleCalendarUrl(request.url);
    const validate = (value: string) =>
      request.calendarUrl
        ? calendarObjectUrl(value, request.calendarUrl)
        : appleCalendarUrl(value);
    if (request.calendarUrl) url = validate(url.href);
    for (let redirects = 0; redirects <= 3; redirects++) {
      if (Date.now() >= deadline)
        throw new CalendarError(
          "network",
          "Sync reached its time limit. Saved changes are safe; sync again to finish.",
        );
      let response: Response;
      try {
        response = await requestFetch(url, {
          method: request.method,
          body: request.body,
          redirect: "manual",
          cache: "no-store",
          signal: AbortSignal.timeout(
            Math.max(1, Math.min(15000, deadline - Date.now())),
          ),
          headers: {
            ...request.headers,
            Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64")}`,
            "Content-Type":
              request.method === "PUT"
                ? "text/calendar; charset=utf-8"
                : "application/xml; charset=utf-8",
          },
        });
        if ([301, 302, 307, 308].includes(response.status)) {
          const location = response.headers.get("location");
          await response.body?.cancel();
          if (!location || redirects === 3)
            throw new CalendarError(
              "invalid",
              "iCloud calendar discovery returned too many redirects.",
            );
          url = validate(new URL(location, url).href);
          continue;
        }
        authorizeStatus(response.status);
        return {
          status: response.status,
          body: await boundedText(response),
          etag: response.headers.get("etag"),
          url: url.href,
        };
      } catch (error) {
        if (error instanceof CalendarError) throw error;
        throw new CalendarError(
          "network",
          "Could not reach iCloud. Check your connection and try again.",
        );
      }
    }
    throw new CalendarError("network", "iCloud calendar request failed.");
  };
}
