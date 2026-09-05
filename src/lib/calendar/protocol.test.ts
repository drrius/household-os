import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { appleCalendarUrl, calendarObjectUrl } from "./apple-url";
import { encryptCredentials, decryptCredentials } from "./credentials";
import { createCaldavTransport } from "./transport";
import { parseMultistatus, davText } from "./xml";
import { writeAppleEvent } from "./caldav";
afterEach(() => vi.unstubAllEnvs());
describe("private iCloud protocol boundaries", () => {
  it.each([
    "https://evil.example/",
    "http://caldav.icloud.com/",
    "https://caldav.icloud.com.evil.example/",
    "https://u:p@caldav.icloud.com/",
    "https://p12-caldav.icloud.com:8443/",
  ])("rejects unsafe endpoint %s", (url) =>
    expect(() => appleCalendarUrl(url)).toThrow(),
  );
  it("requires writes to stay inside the selected calendar", () => {
    expect(() =>
      calendarObjectUrl(
        "https://p12-caldav.icloud.com/other/event.ics",
        "https://p12-caldav.icloud.com/calendar/",
      ),
    ).toThrow();
  });
  it("rejects redirect before credentials can leave Apple's hosts", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/steal" },
      }),
    );
    await expect(
      createCaldavTransport(
        { username: "person@example.com", password: "aaaa-bbbb-cccc-dddd" },
        request,
      )({ url: "https://caldav.icloud.com/", method: "PROPFIND" }),
    ).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("authenticates encrypted credentials to the household", () => {
    vi.stubEnv(
      "HOUSEHOLD_CALENDAR_ENCRYPTION_KEY",
      Buffer.alloc(32, 1).toString("base64"),
    );
    const credentials = {
      username: "person@example.com",
      password: "aaaa-bbbb-cccc-dddd",
    };
    const encrypted = encryptCredentials(credentials, "household-a");
    expect(encrypted).not.toContain(credentials.password);
    expect(decryptCredentials(encrypted, "household-a")).toEqual(credentials);
    expect(() => decryptCredentials(encrypted, "household-b")).toThrow(
      "cannot be unlocked",
    );
  });
  it("rejects XML entities but decodes literal calendar text once", () => {
    expect(() =>
      parseMultistatus(
        '<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///etc/passwd">]><multistatus/>',
      ),
    ).toThrow();
    expect(davText("A &amp; B &lt;test&gt; &amp;lt;")).toBe(
      "A & B <test> &lt;",
    );
  });
  it("uses ETags and preserves both edits on a precondition failure", async () => {
    const transport = vi.fn().mockResolvedValue({
      status: 412,
      body: "",
      etag: null,
      url: "https://p12-caldav.icloud.com/calendar/event.ics",
    });
    await expect(
      writeAppleEvent(transport, {
        calendarUrl: "https://p12-caldav.icloud.com/calendar/",
        href: "https://p12-caldav.icloud.com/calendar/event.ics",
        etag: '"v1"',
        ical: "event",
      }),
    ).rejects.toThrow("changed in Apple Calendar");
    expect(transport.mock.calls[0]?.[0].headers).toEqual({
      "If-Match": '"v1"',
    });
  });
});

it.each([
  new DOMException("Timed out", "AbortError"),
  new Error("connection reset"),
])(
  "maps interrupted response bodies to a retryable calendar error",
  async (failure) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(failure);
          },
        }),
      ),
    );
    await expect(
      createCaldavTransport(
        { username: "test", password: "test" },
        request,
      )({
        url: "https://caldav.icloud.com/",
        method: "GET",
      }),
    ).rejects.toMatchObject({
      name: "CalendarError",
      code: "network",
      message: "Could not reach iCloud. Check your connection and try again.",
    });
  },
);
