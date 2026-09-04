"use client";

import { useRef, useState } from "react";
import type { AttachmentPurpose } from "@/domain/attachments/files";
import { prepareAttachment } from "@/lib/attachments/prepare-image.client";

async function discard(path: string) {
  const response = await fetch(
    `/api/attachments?path=${encodeURIComponent(path)}`,
    { method: "DELETE" },
  );
  if (!response.ok)
    throw new Error("Couldn't remove the attachment. Try removing it again.");
}

function clearInput(input: { current: HTMLInputElement | null }) {
  if (input.current) {
    input.current.value = "";
    input.current.setCustomValidity("");
  }
}

class UploadRejection extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

async function sendUpload(
  file: File,
  purpose: AttachmentPurpose,
  id: string,
): Promise<string> {
  const prepared = await prepareAttachment(file);
  const form = new FormData();
  form.set("file", prepared);
  form.set("purpose", purpose);
  form.set("uploadId", id);
  const response = await fetch("/api/attachments", {
    method: "POST",
    body: form,
  });
  const result: { path?: string; error?: string } = await response.json();
  if (!response.ok || !result.path)
    throw new UploadRejection(
      result.error ?? "Couldn't upload the attachment.",
      response.status >= 500 ||
        response.status === 408 ||
        response.status === 429,
    );
  return result.path;
}

function uploadError(failure: unknown) {
  return failure instanceof Error
    ? failure.message
    : "Couldn't upload the attachment.";
}

function rejectValidity(
  input: { current: HTMLInputElement | null },
  retryable: boolean,
) {
  input.current?.setCustomValidity(
    retryable
      ? "Retry, choose another file, or remove this attachment before saving."
      : "Choose the file again or remove this attachment before saving.",
  );
}

export function useAttachmentUpload(
  purpose: AttachmentPurpose,
  initialPath: string | null,
) {
  const input = useRef<HTMLInputElement>(null);
  const attempt = useRef<{ file: File; id: string } | null>(null);
  const [path, setPath] = useState(initialPath ?? "");
  const [pending, setPending] = useState(false);
  const [pendingLabel, setPendingLabel] = useState("Uploading…");
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  async function upload(file: File, id = crypto.randomUUID()) {
    setPendingLabel("Uploading…");
    attempt.current = { file, id };
    setPending(true);
    setError(null);
    setCanRetry(false);
    input.current?.setCustomValidity(
      "Wait for the attachment to finish uploading.",
    );
    try {
      const uploadedPath = await sendUpload(file, purpose, id);
      const previous = path;
      setPath(uploadedPath);
      attempt.current = null;
      clearInput(input);
      // Linked files are retained by the database. Failed cleanup is retried
      // opportunistically; it must not discard this successful replacement.
      if (previous && previous !== uploadedPath)
        await discard(previous).catch(() => {});
    } catch (failure) {
      setError(uploadError(failure));
      const retryable =
        !(failure instanceof UploadRejection) || failure.retryable;
      setCanRetry(retryable);
      if (!retryable) attempt.current = null;
      rejectValidity(input, retryable);
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPendingLabel("Removing…");
    input.current?.setCustomValidity(
      "Wait for the attachment to finish removing.",
    );
    setPending(true);
    setCanRetry(false);
    try {
      if (path) await discard(path);
      setPath("");
      setError(null);
      attempt.current = null;
      clearInput(input);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Couldn't remove the attachment.",
      );
    } finally {
      setPending(false);
    }
  }
  function retry() {
    if (attempt.current) void upload(attempt.current.file, attempt.current.id);
  }
  return {
    input,
    path,
    pending,
    pendingLabel,
    error,
    upload,
    remove,
    canRetry,
    retry,
  };
}
