import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  member: vi.fn(),
  upload: vi.fn(),
  sign: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/auth/member-context", () => ({ getMemberContext: mock.member }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ storage: { from: mock.from } }),
}));
import { GET, POST } from "./route";

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
  return new Request("https://home.example/api/attachments", {
    method: "POST",
    headers: { origin: "https://home.example" },
    body: form,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.member.mockResolvedValue({ householdId: household });
  mock.from.mockReturnValue({
    upload: mock.upload,
    createSignedUrl: mock.sign,
  });
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
  it("uploads with a fresh server-chosen path and inspected content type", async () => {
    const response = await POST(uploadRequest());
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.path).toMatch(new RegExp(`^${household}/receipts/.+\\.pdf$`));
    expect(mock.upload).toHaveBeenCalledWith(
      result.path,
      expect.any(Uint8Array),
      { contentType: "application/pdf", upsert: false },
    );
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
    mock.upload.mockResolvedValue({
      error: { message: "internal bucket credentials" },
    });
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
