// ADR0020 specifies decimal MB, independently of the per-file byte limit.
export const ATTACHMENT_WARNING_BYTES = 500_000_000n;
export type AttachmentUsage =
  | { status: "loading" }
  | { status: "unavailable" }
  | {
      status: "available";
      totalBytes: string;
      usedLabel: string;
      warning: boolean;
    };
function sizeLabel(bytes: bigint): string {
  if (bytes < 1000n) return `${bytes} ${bytes === 1n ? "byte" : "bytes"}`;
  const [unit, divisor] =
    bytes >= 1_000_000_000n
      ? (["GB", 1_000_000_000n] as const)
      : bytes >= 1_000_000n
        ? (["MB", 1_000_000n] as const)
        : (["kB", 1000n] as const);
  const whole = bytes / divisor,
    tenth = ((bytes % divisor) * 10n) / divisor;
  return `${whole.toLocaleString("en-CH")}${tenth ? `.${tenth}` : ""} ${unit}`;
}
export function attachmentUsage(value: unknown): AttachmentUsage {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value))
    return { status: "unavailable" };
  const bytes = BigInt(value);
  return {
    status: "available",
    totalBytes: value,
    usedLabel: sizeLabel(bytes),
    warning: bytes >= ATTACHMENT_WARNING_BYTES,
  };
}
