"use client";

import { useEffect, useId } from "react";
import type { AttachmentPurpose } from "@/domain/attachments/files";
import { useAttachmentUpload } from "./use-attachment-upload.client";

type AttachmentFieldProps = {
  name: string;
  label: string;
  purpose: AttachmentPurpose;
  initialPath?: string | null;
  required?: boolean;
  onStateChange?: () => void;
};

function attachmentStatus(
  pending: boolean,
  error: string | null,
  path: string,
  pendingLabel: string,
) {
  if (pending) return pendingLabel;
  return (
    error ??
    (path
      ? "Attachment ready."
      : "Photos are resized. Maximum file size: 4 MB.")
  );
}

export function AttachmentField({
  name,
  label,
  purpose,
  initialPath = "",
  required = false,
  onStateChange,
}: AttachmentFieldProps) {
  const id = useId();
  const {
    input,
    path,
    pending,
    pendingLabel,
    error,
    upload,
    remove,
    canRetry,
    retry,
  } = useAttachmentUpload(purpose, initialPath);

  useEffect(() => {
    onStateChange?.();
  }, [path, pending, error, onStateChange]);

  const accept =
    purpose === "completions" ? "image/*" : "image/*,application/pdf";
  return (
    <div className="grid gap-2 text-base sm:text-sm">
      <label className="font-medium" htmlFor={id}>
        {label}{" "}
        {!required ? (
          <span className="font-normal text-muted-foreground">(optional)</span>
        ) : null}
      </label>
      <input type="hidden" name={name} value={path} />
      <input
        ref={input}
        id={id}
        name={`${name}Upload`}
        type="file"
        accept={accept}
        aria-describedby={`${id}-status`}
        aria-invalid={error !== null}
        aria-disabled={pending}
        className="min-h-11 w-full min-w-0 rounded-lg border border-input p-2 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-secondary-foreground"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && !pending) void upload(file);
        }}
        onClick={(event) => {
          if (pending) event.preventDefault();
        }}
      />
      <p
        id={`${id}-status`}
        role="status"
        className={error ? "text-destructive-strong" : "text-muted-foreground"}
      >
        {attachmentStatus(pending, error, path, pendingLabel)}
      </p>
      {(path || error) && !pending ? (
        <AttachmentActions
          path={path}
          canRetry={canRetry}
          retry={retry}
          remove={remove}
        />
      ) : null}
    </div>
  );
}

function AttachmentActions({
  path,
  canRetry,
  retry,
  remove,
}: {
  path: string;
  canRetry: boolean;
  retry: () => void;
  remove: () => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {path ? (
        <a
          className="min-h-11 content-center underline"
          href={`/api/attachments?path=${encodeURIComponent(path)}`}
          target="_blank"
          rel="noreferrer"
        >
          View attachment
        </a>
      ) : null}
      {canRetry ? (
        <button
          type="button"
          className="min-h-11 cursor-pointer underline"
          onClick={retry}
        >
          Retry upload
        </button>
      ) : null}
      <button
        type="button"
        className="min-h-11 cursor-pointer text-muted-foreground underline"
        onClick={remove}
      >
        Remove attachment
      </button>
    </div>
  );
}
