import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mock = vi.hoisted(() => ({
  member: vi.fn(),
  fetch: vi.fn(),
  rpc: vi.fn(),
  remove: vi.fn(),
  upload: vi.fn(),
  sign: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/auth/member-context", () => ({ getMemberContext: mock.member }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    storage: { from: mock.from },
    rpc: mock.rpc,
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "fixture-session" } },
      }),
    },
  }),
}));
vi.mock("@/lib/env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://storage.example",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public",
  }),
}));
import { DELETE, GET, POST } from "./route";

const household = "00000000-0000-4000-8000-000000000001";
const path = `${household}/receipts/00000000-0000-4000-8000-000000000002.pdf`;
function uploadRequest(
  bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10, 0, 0, 0]),
  purpose = "receipts",
) {
  const form = new FormData();
  form.set(
    "file",
    new File([bytes], "anything.svg", { type: "image/svg+xml" }),
  );
  form.set("purpose", purpose);
  form.set("uploadId", "00000000-0000-4000-8000-000000000002");
  return new Request("https://home.example/api/attachments", {
    method: "POST",
    headers: { origin: "https://home.example" },
    body: form,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.member.mockResolvedValue({ householdId: household });
  vi.stubGlobal("fetch", mock.fetch);
  mock.fetch.mockImplementation(async () =>
    Response.json({ path }, { status: 201 }),
  );
  mock.from.mockReturnValue({
    upload: mock.upload,
    remove: mock.remove,
    createSignedUrl: mock.sign,
  });
  mock.rpc.mockImplementation(async (name: string) => ({
    data: name === "reserve_household_attachment" ? false : [],
    error: null,
  }));
  mock.remove.mockResolvedValue({ error: null });
  mock.upload.mockResolvedValue({ error: null });
  mock.sign.mockResolvedValue({
    data: { signedUrl: "https://storage.example/private" },
    error: null,
  });
});

describe("private attachment routes", () => {
  it("requires a signed-in household member and same-origin upload", async () => {
    const crossOrigin = new Request("https://home.example/api/attachments", {
      method: "POST",
      headers: { origin: "https://elsewhere.example" },
    });
    expect((await POST(crossOrigin)).status).toBe(403);
    mock.member.mockResolvedValue(null);
    expect((await POST(uploadRequest())).status).toBe(401);
    expect(
      (
        await GET(
          new Request(`https://home.example/api/attachments?path=${path}`),
        )
      ).status,
    ).toBe(401);
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("uploads with a reserved immutable path and inspected content type", async () => {
    const response = await POST(uploadRequest());
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.path).toMatch(new RegExp(`^${household}/receipts/.+\\.pdf$`));
    expect(mock.fetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        body: expect.any(Uint8Array),
        headers: expect.objectContaining({ "Content-Type": "application/pdf" }),
      }),
    );
    expect(mock.upload).not.toHaveBeenCalled();
  });
  it("rejects unsupported content and PDF completion photos", async () => {
    expect((await POST(uploadRequest(new Uint8Array(20)))).status).toBe(400);
    expect((await POST(uploadRequest(undefined, "completions"))).status).toBe(
      400,
    );
    expect(mock.upload).not.toHaveBeenCalled();
  });
  it("bounds the body even without a Content-Length header", async () => {
    const response = await POST(
      new Request("https://home.example/api/attachments", {
        method: "POST",
        headers: {
          origin: "https://home.example",
          "content-type": "application/octet-stream",
        },
        body: new Uint8Array(4 * 1024 * 1024 + 65537),
      }),
    );
    expect(response.status).toBe(413);
    expect(mock.upload).not.toHaveBeenCalled();
  });
  it("keeps storage failure details private", async () => {
    mock.fetch.mockResolvedValue(
      Response.json({ error: "internal bucket credentials" }, { status: 502 }),
    );
    const response = await POST(uploadRequest());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("credentials");
  });
  it("never signs a different household's file or an arbitrary URL", async () => {
    expect(
      (
        await GET(
          new Request(
            `https://home.example/api/attachments?path=${path.replace(household, "00000000-0000-4000-8000-000000000003")}`,
          ),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await GET(
          new Request(
            "https://home.example/api/attachments?path=https://external.example",
          ),
        )
      ).status,
    ).toBe(404);
    expect(mock.sign).not.toHaveBeenCalled();
  });
  it("issues a short-lived download only after household authorization", async () => {
    const response = await GET(
      new Request(`https://home.example/api/attachments?path=${path}`),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mock.sign).toHaveBeenCalledWith(path, 60, { download: true });
  });
});

describe("attachment retries and cleanup", () => {
  it("recovers a lost upload response without writing another object", async () => {
    mock.rpc.mockImplementation(async (name: string) => ({
      data: name === "reserve_household_attachment" ? true : [],
      error: null,
    }));
    expect((await POST(uploadRequest())).status).toBe(201);
    expect(mock.upload).not.toHaveBeenCalled();
  });
  it("does not upload when a removed path cannot be reserved again", async () => {
    mock.fetch.mockResolvedValue(
      Response.json({ error: "expired" }, { status: 409 }),
    );
    expect((await POST(uploadRequest())).status).toBe(409);
    expect(mock.upload).not.toHaveBeenCalled();
  });
  it("only removes paths returned by the atomic cleanup claim", async () => {
    mock.rpc.mockResolvedValue({ data: [], error: null });
    const request = () =>
      new Request(`https://home.example/api/attachments?path=${path}`, {
        method: "DELETE",
        headers: { origin: "https://home.example" },
      });
    expect((await DELETE(request())).status).toBe(204);
    expect(mock.remove).not.toHaveBeenCalled();
    mock.rpc.mockImplementation(async (name: string) => ({
      data: name === "begin_household_attachment_cleanup" ? [{ path }] : null,
      error: null,
    }));
    expect((await DELETE(request())).status).toBe(204);
    expect(mock.remove).toHaveBeenCalledWith([path]);
    expect(mock.rpc).toHaveBeenCalledWith(
      "finish_household_attachment_cleanup",
      { p_path: path },
    );
  });
  it("batches only atomically claimed cleanup paths and finishes them after deletion", async () => {
    const second = path.replace("000000000002.pdf", "000000000003.pdf");
    mock.rpc.mockImplementation(async (name: string) => ({
      data:
        name === "begin_household_attachment_cleanup"
          ? [{ path }, { path: second }]
          : null,
      error: null,
    }));
    expect(
      (
        await DELETE(
          new Request(`https://home.example/api/attachments?path=${path}`, {
            method: "DELETE",
            headers: { origin: "https://home.example" },
          }),
        )
      ).status,
    ).toBe(204);
    expect(mock.remove).toHaveBeenCalledTimes(1);
    expect(mock.remove).toHaveBeenCalledWith([path, second]);
    expect(mock.rpc).toHaveBeenCalledWith(
      "finish_household_attachment_cleanup",
      { p_path: second },
    );
  });
  it("leaves failed deletions available for retry", async () => {
    mock.rpc.mockResolvedValue({ data: [{ path }], error: null });
    mock.remove.mockResolvedValue({ error: {} });
    expect(
      (
        await DELETE(
          new Request(`https://home.example/api/attachments?path=${path}`, {
            method: "DELETE",
            headers: { origin: "https://home.example" },
          }),
        )
      ).status,
    ).toBe(502);
    expect(mock.rpc).not.toHaveBeenCalledWith(
      "finish_household_attachment_cleanup",
      expect.anything(),
    );
  });
  it("authorizes removal before touching storage", async () => {
    const request = (origin: string, requestedPath = path) =>
      new Request(
        `https://home.example/api/attachments?path=${requestedPath}`,
        { method: "DELETE", headers: { origin } },
      );
    expect((await DELETE(request("https://other.example"))).status).toBe(403);
    expect(
      (await DELETE(request("https://home.example", "wrong/path"))).status,
    ).toBe(404);
    mock.member.mockResolvedValue(null);
    expect((await DELETE(request("https://home.example"))).status).toBe(401);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});
