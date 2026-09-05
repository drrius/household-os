import type { ReactNode } from "react";
import type { AttachmentUsage } from "@/domain/attachments/usage";
import { UsageRetry } from "./usage-retry.client";
export function AttachmentUsageDisplay({
  usage,
  retry,
}: {
  usage: AttachmentUsage;
  retry?: ReactNode;
}) {
  if (usage.status === "loading")
    return (
      <p className="text-base" role="status">
        Checking attachment usage…
      </p>
    );
  if (usage.status === "unavailable")
    return (
      <div className="grid gap-2 text-base">
        <p role="status">
          Storage usage is unavailable. We can’t check the 500 MB warning right
          now.
        </p>
        {retry ?? <UsageRetry />}
      </div>
    );
  return (
    <div className="grid gap-2 text-base">
      <p
        className="tabular-nums wrap-anywhere"
        title={`${usage.totalBytes} bytes`}
      >
        {usage.usedLabel} used · Private photos & PDFs
      </p>
      {usage.warning ? (
        <div
          role="status"
          className="rounded-lg border border-warning/40 bg-warning-soft p-3 text-warning-foreground"
        >
          <p className="font-medium">Attachment storage has reached 500 MB.</p>
          <p>
            You can keep uploading. Keep an eye on storage so it stays within
            the free plan.
          </p>
        </div>
      ) : (
        <p>We’ll warn you at 500 MB. Each file can be up to 4 MB.</p>
      )}
    </div>
  );
}
