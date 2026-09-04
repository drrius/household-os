export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
export const ATTACHMENT_BUCKET = "household-files";
export const ATTACHMENT_PURPOSES = [
  "receipts",
  "completions",
  "documents",
] as const;
export type AttachmentPurpose = (typeof ATTACHMENT_PURPOSES)[number];

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const pathPattern = new RegExp(
  `^(${uuid})/(receipts|completions|documents)/${uuid}\\.(jpg|png|webp|pdf)$`,
  "i",
);

export function isHouseholdAttachment(
  path: string,
  householdId: string,
): boolean {
  const match = pathPattern.exec(path);
  return (
    match !== null && match[1]?.toLowerCase() === householdId.toLowerCase()
  );
}

export function attachmentFileType(
  bytes: Uint8Array,
): { extension: string; mime: string } | null {
  if (bytes.length < 12 || bytes.length > MAX_ATTACHMENT_BYTES) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", mime: "image/jpeg" };
  }
  if (
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => bytes[index] === byte,
    )
  ) {
    return { extension: "png", mime: "image/png" };
  }
  if (
    [82, 73, 70, 70].every((byte, index) => bytes[index] === byte) &&
    [87, 69, 66, 80].every((byte, index) => bytes[index + 8] === byte)
  ) {
    return { extension: "webp", mime: "image/webp" };
  }
  if ([37, 80, 68, 70, 45].every((byte, index) => bytes[index] === byte)) {
    return { extension: "pdf", mime: "application/pdf" };
  }
  return null;
}
