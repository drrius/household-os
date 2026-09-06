import { expect, it, vi } from "vitest";
import fc from "fast-check";
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
it.each(["", ' content-type="text/calendar" version="2.0"'])(
  "reads calendar text with XML attributes %s",
  async (attributes) => {
    const ical =
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Us & home\r\nEND:VEVENT\r\nEND:VCALENDAR";
    const transport = vi.fn().mockResolvedValue({
      status: 207,
      url: "https://p12-caldav.icloud.com/home/shared/",
      body: multistatus(
        resource(
          "/home/shared/event.ics",
          `<d:getetag>&quot;v1&quot;</d:getetag><c:calendar-data${attributes}>${ical.replaceAll("&", "&amp;")}</c:calendar-data>`,
        ),
      ),
    });
    await expect(
      readAppleCalendar(
        transport,
        "https://p12-caldav.icloud.com/home/shared/",
      ),
    ).resolves.toEqual([
      {
        href: "https://p12-caldav.icloud.com/home/shared/event.ics",
        etag: '"v1"',
        ical: ical.replaceAll("\r\n", "\n"),
      },
    ]);
  },
);
it.each([
  "<d:getetag>v1</d:getetag>",
  '<d:getetag>v1</d:getetag><c:calendar-data content-type="text/calendar"/>',
  "<d:getetag>v1</d:getetag><c:calendar-data><c:unexpected>event</c:unexpected></c:calendar-data>",
])(
  "rejects incomplete multistatus before treating absent events as deleted: %s",
  async (properties) => {
    const transport = vi.fn().mockResolvedValue({
      status: 207,
      url: "https://p12-caldav.icloud.com/home/shared/",
      body: multistatus(resource("/home/shared/event.ics", properties)),
    });
    await expect(
      readAppleCalendar(
        transport,
        "https://p12-caldav.icloud.com/home/shared/",
      ),
    ).rejects.toThrow("incomplete event listing");
  },
);
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

it.each([
  ["<d:getetag>private-etag</d:getetag>", "S200/P200/Etext/Dmissing/C0"],
  [
    "<c:calendar-data>private-event</c:calendar-data>",
    "S200/P200/Emissing/Dtext/C0",
  ],
  ["<d:getetag/>", "S200/P200/Eempty/Dmissing/C0"],
  [
    '<c:calendar-data content-type="text/calendar"/>',
    "S200/P200/Emissing/Dstructured/C0",
  ],
])(
  "explains incomplete listings without exposing calendar content: %s",
  async (properties, diagnostic) => {
    const transport = vi.fn().mockResolvedValue({
      status: 207,
      url: "https://p12-caldav.icloud.com/home/shared/",
      body: multistatus(resource("/home/shared/private-id.ics", properties)),
    });
    await expect(
      readAppleCalendar(
        transport,
        "https://p12-caldav.icloud.com/home/shared/",
      ),
    ).rejects.toThrow(
      `iCloud returned an incomplete event listing. No missing events were removed. Diagnostic: ${diagnostic}.`,
    );
  },
);

it("reports failed property statuses and collection-shaped responses without their URLs", async () => {
  const transport = vi.fn().mockResolvedValue({
    status: 207,
    body: multistatus(
      "<d:response><d:href>/private-calendar/</d:href><d:propstat><d:prop><d:getetag/><c:calendar-data/></d:prop><d:status>HTTP/1.1 404 Not Found</d:status></d:propstat></d:response>",
    ),
  });
  await expect(
    readAppleCalendar(transport, "https://p12-caldav.icloud.com/home/shared/"),
  ).rejects.toThrow("Diagnostic: S200/P404/Emissing/Dmissing/C1.");
});

const collectionResponse = (href: string, status = "200 OK") =>
  `<d:response><d:href>${href}</d:href><d:status>HTTP/1.1 ${status}</d:status><d:propstat><d:prop><d:getetag>collection-etag</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat><d:propstat><d:prop><c:calendar-data/></d:prop><d:status>HTTP/1.1 404 Not Found</d:status></d:propstat></d:response>`;

it.each(["/home/shared/", "https://p12-caldav.icloud.com/home/shared/"])(
  "reads events when iCloud includes the selected collection: %s",
  async (href) => {
    const transport = vi.fn().mockResolvedValue({
      status: 207,
      body: multistatus(
        collectionResponse(href) +
          resource(
            "/home/shared/event.ics",
            "<d:getetag>event-etag</d:getetag><c:calendar-data>BEGIN:VCALENDAR\nEND:VCALENDAR</c:calendar-data>",
          ),
      ),
    });
    await expect(
      readAppleCalendar(
        transport,
        "https://p12-caldav.icloud.com/home/shared/",
      ),
    ).resolves.toEqual([
      {
        href: "https://p12-caldav.icloud.com/home/shared/event.ics",
        etag: "event-etag",
        ical: "BEGIN:VCALENDAR\nEND:VCALENDAR",
      },
    ]);
  },
);

it("accepts an empty calendar represented by its collection alone", async () => {
  const transport = vi.fn().mockResolvedValue({
    status: 207,
    body: multistatus(collectionResponse("/home/shared/")),
  });
  await expect(
    readAppleCalendar(transport, "https://p12-caldav.icloud.com/home/shared/"),
  ).resolves.toEqual([]);
});

it.each([
  ["/home/shared/event.ics", "200 OK"],
  ["/home/shared/nested/", "200 OK"],
  ["/home/other/", "200 OK"],
  ["https://p13-caldav.icloud.com/home/shared/", "200 OK"],
  ["", "200 OK"],
  ["/home/shared/", "403 Forbidden"],
])(
  "does not ignore an incomplete or failed resource %s (%s)",
  async (href, status) => {
    const transport = vi.fn().mockResolvedValue({
      status: 207,
      body: multistatus(collectionResponse(href, status)),
    });
    await expect(
      readAppleCalendar(
        transport,
        "https://p12-caldav.icloud.com/home/shared/",
      ),
    ).rejects.toThrow();
  },
);

it("never drops incomplete child resources when omitting the collection", async () => {
  await fc.assert(
    fc.asyncProperty(fc.uuid(), fc.boolean(), async (id, directory) => {
      const transport = vi.fn().mockResolvedValue({
        status: 207,
        body: multistatus(
          collectionResponse("/home/shared/") +
            collectionResponse(`/home/shared/${id}${directory ? "/" : ".ics"}`),
        ),
      });
      await expect(
        readAppleCalendar(
          transport,
          "https://p12-caldav.icloud.com/home/shared/",
        ),
      ).rejects.toThrow("incomplete event listing");
    }),
    { numRuns: 50 },
  );
});

it("does not ignore a collection-level property permission failure", async () => {
  const transport = vi.fn().mockResolvedValue({
    status: 207,
    body: multistatus(
      collectionResponse("/home/shared/").replace(
        "404 Not Found",
        "403 Forbidden",
      ),
    ),
  });
  await expect(
    readAppleCalendar(transport, "https://p12-caldav.icloud.com/home/shared/"),
  ).rejects.toThrow("incomplete event listing");
});
