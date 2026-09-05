import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { discoverAppleCalendars, readAppleCalendar } from "./caldav";
import { createCaldavTransport } from "./transport";
const multistatus = (body: string) =>
  `<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">${body}</d:multistatus>`;
const resource = (href: string, body: string) =>
  `<d:response><d:href>${href}</d:href><d:propstat><d:prop>${body}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`;
it("discovers the private calendar home and distinguishes shared write access", async () => {
  const transport = vi
    .fn()
    .mockResolvedValueOnce({
      status: 207,
      url: "https://caldav.icloud.com/",
      body: multistatus(
        resource(
          "/",
          "<d:current-user-principal><d:href>https://p12-caldav.icloud.com/principal/</d:href></d:current-user-principal>",
        ),
      ),
    })
    .mockResolvedValueOnce({
      status: 207,
      url: "https://p12-caldav.icloud.com/principal/",
      body: multistatus(
        resource(
          "/principal/",
          "<c:calendar-home-set><d:href>/home/</d:href></c:calendar-home-set>",
        ),
      ),
    })
    .mockResolvedValueOnce({
      status: 207,
      url: "https://p12-caldav.icloud.com/home/",
      body: multistatus(
        resource(
          "/home/shared/",
          '<d:displayname>Us &amp; home</d:displayname><d:resourcetype><c:calendar/></d:resourcetype><d:current-user-privilege-set><d:privilege><d:write/></d:privilege></d:current-user-privilege-set><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>',
        ) +
          resource(
            "/home/subscribed/",
            "<d:displayname>Holidays</d:displayname><d:resourcetype><c:calendar/></d:resourcetype>",
          ),
      ),
    });
  expect(await discoverAppleCalendars(transport)).toEqual([
    {
      url: "https://p12-caldav.icloud.com/home/shared/",
      name: "Us & home",
      readOnly: false,
    },
    {
      url: "https://p12-caldav.icloud.com/home/subscribed/",
      name: "Holidays",
      readOnly: true,
    },
  ]);
  expect(transport.mock.calls[2]?.[0].headers).toEqual({ Depth: "1" });
});
it("rejects incomplete multistatus before treating absent events as deleted", async () => {
  const transport = vi.fn().mockResolvedValue({
    status: 207,
    url: "https://p12-caldav.icloud.com/home/shared/",
    body: multistatus(
      resource("/home/shared/event.ics", "<d:getetag>v1</d:getetag>"),
    ),
  });
  await expect(
    readAppleCalendar(transport, "https://p12-caldav.icloud.com/home/shared/"),
  ).rejects.toThrow("incomplete event listing");
});
it("bounds the response body and the total sync deadline", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response("x".repeat(4 * 1024 * 1024 + 1)));
  const credentials = {
    username: "person@example.com",
    password: "aaaa-bbbb-cccc-dddd",
  };
  await expect(
    createCaldavTransport(
      credentials,
      fetcher,
    )({ url: "https://caldav.icloud.com/", method: "PROPFIND" }),
  ).rejects.toThrow("too large");
  fetcher.mockClear();
  await expect(
    createCaldavTransport(
      credentials,
      fetcher,
      Date.now() - 1,
    )({ url: "https://caldav.icloud.com/", method: "PROPFIND" }),
  ).rejects.toThrow("time limit");
  expect(fetcher).not.toHaveBeenCalled();
});
