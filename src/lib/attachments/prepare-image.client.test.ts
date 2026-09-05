import { afterEach, expect, it, vi } from "vitest";
import { prepareAttachment } from "./prepare-image.client";

afterEach(() => vi.unstubAllGlobals());
it("recognizes a PDF with an empty browser MIME type", async () => {
  const prepared = await prepareAttachment(
    new File(["%PDF-1.7\nfixture"], "receipt.pdf"),
  );
  expect(prepared.type).toBe("application/pdf");
  expect(await prepared.text()).toBe("%PDF-1.7\nfixture");
});
it("decodes a photo with an empty browser MIME type", async () => {
  const close = vi.fn();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 1, height: 1, close })),
  );
  vi.stubGlobal("document", {
    createElement: () => ({
      getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn() }),
      toBlob: (callback: (blob: Blob) => void) =>
        callback(new Blob(["photo"], { type: "image/jpeg" })),
    }),
  });
  const prepared = await prepareAttachment(
    new File(
      [new Uint8Array([255, 216, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
      "photo.jpg",
    ),
  );
  expect(prepared.type).toBe("image/jpeg");
  expect(close).toHaveBeenCalledOnce();
});
it("rejects unknown bytes with no MIME type", async () => {
  await expect(
    prepareAttachment(new File(["not an attachment"], "file")),
  ).rejects.toThrow("Choose a photo or PDF");
});

it("rejects an oversized PDF before any image preparation", async () => {
  const decode = vi.fn();
  vi.stubGlobal("createImageBitmap", decode);
  await expect(
    prepareAttachment(
      new File(["%PDF-1.7\n", new Uint8Array(4 * 1024 * 1024)], "large.pdf"),
    ),
  ).rejects.toThrow("smaller than 4 MB");
  expect(decode).not.toHaveBeenCalled();
});
it("explains when a photo cannot be decoded", async () => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockRejectedValue(new Error("Invalid image")),
  );
  await expect(
    prepareAttachment(
      new File(["invalid image"], "broken.jpg", { type: "image/jpeg" }),
    ),
  ).rejects.toThrow("Choose another image");
});
