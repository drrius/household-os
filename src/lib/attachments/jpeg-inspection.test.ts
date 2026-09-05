import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import jpeg from "jpeg-js";
import {
  inspectAttachment,
  JPEG_DECODE_LIMITS,
} from "../../../supabase/functions/household-attachment-upload/inspect";
const small = new Uint8Array(
  jpeg.encode(
    { width: 16, height: 16, data: new Uint8Array(16 * 16 * 4).fill(255) },
    85,
  ).data,
);
const inspect = (bytes: Uint8Array) => inspectAttachment(bytes, jpeg.decode);
const fixture = (name: string) =>
  new Uint8Array(readFileSync(`tests/fixtures/attachments/${name}.jpg`));
it("fully decodes baseline, progressive, and restart-marker JPEGs", () => {
  for (const bytes of [small, fixture("progressive"), fixture("restarts")])
    expect(inspect(bytes)).toEqual({ extension: "jpg", mime: "image/jpeg" });
});
it("retains valid EXIF and comment segments without rewriting the original bytes", () => {
  const exif = new Uint8Array([
    0xff, 0xe1, 0, 22, 69, 120, 105, 102, 0, 0, 73, 73, 42, 0, 8, 0, 0, 0, 0, 0,
    0, 0, 0, 0,
  ]);
  const bytes = new Uint8Array([
    ...small.slice(0, 2),
    ...exif,
    0xff,
    0xfe,
    0,
    6,
    84,
    101,
    115,
    116,
    ...small.slice(2),
  ]);
  const original = bytes.slice();
  expect(inspect(bytes)?.mime).toBe("image/jpeg");
  expect(bytes).toEqual(original);
});
it("accepts the client's maximum 2000 by 2000 output within the explicit decoder cap", () => {
  const bytes = jpeg.encode(
    {
      width: 2000,
      height: 2000,
      data: new Uint8Array(2000 * 2000 * 4).fill(255),
    },
    85,
  ).data;
  expect(bytes.length).toBeLessThan(4 * 1024 * 1024);
  expect(inspect(bytes)?.mime).toBe("image/jpeg");
  expect(JPEG_DECODE_LIMITS).toMatchObject({
    maxResolutionInMP: 4,
    maxMemoryUsageInMB: 96,
    tolerantDecoding: false,
  });
});
it("rejects prefix-only, truncated, appended, and concatenated JPEG payloads", () => {
  const samples = [
    new Uint8Array([255, 216, 255, 0, 0, 0, 0, 0, 0, 0, 255, 217]),
    small.slice(0, -2),
    new Uint8Array([...small.slice(0, -8), 255, 217]),
    new Uint8Array([...small, 60, 115, 99, 114, 105, 112, 116, 62]),
    new Uint8Array([...small, ...small]),
  ];
  for (const bytes of samples) expect(inspect(bytes)).toBeNull();
});
it("rejects missing scans and malformed entropy before any storage grant", () => {
  const scan = small.findIndex(
    (byte, index) => byte === 255 && small[index + 1] === 0xda,
  );
  expect(
    inspect(new Uint8Array([...small.slice(0, scan), 255, 217])),
  ).toBeNull();
  const start = scan + 2 + small[scan + 2]! * 256 + small[scan + 3]!;
  expect(
    inspect(new Uint8Array([...small.slice(0, start), 0, 255, 217])),
  ).toBeNull();
});
it("rejects an early EOI at a restart boundary instead of accepting partially decoded pixels", () => {
  const bytes = fixture("restarts");
  const restart = bytes.findIndex(
    (byte, index) => byte === 255 && bytes[index + 1] === 0xd0,
  );
  expect(restart).toBeGreaterThan(0);
  expect(
    inspect(new Uint8Array([...bytes.slice(0, restart), 255, 217])),
  ).toBeNull();
  const wrongSequence = bytes.slice();
  wrongSequence[restart + 1] = 0xd4;
  expect(inspect(wrongSequence)).toBeNull();
});
it("bounds dimensions and bytes before invoking the decoder", () => {
  const oversized = small.slice(),
    decode = vi.fn((bytes: Uint8Array, options: typeof JPEG_DECODE_LIMITS) =>
      jpeg.decode(bytes, options),
    );
  const frame = oversized.findIndex(
    (byte, index) => byte === 255 && oversized[index + 1] === 0xc0,
  );
  oversized[frame + 7] = 0x7f;
  oversized[frame + 8] = 0xff;
  expect(inspectAttachment(oversized, decode)).toBeNull();
  expect(
    inspectAttachment(new Uint8Array(4 * 1024 * 1024 + 1), decode),
  ).toBeNull();
  expect(decode).not.toHaveBeenCalled();
});
it("limits new wire images to JPEG while retaining PDF support", () => {
  for (const prefix of [
    [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0],
    [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80],
  ])
    expect(inspect(new Uint8Array(prefix))).toBeNull();
  expect(inspect(new TextEncoder().encode("%PDF-1.7\nfixture"))?.mime).toBe(
    "application/pdf",
  );
});
