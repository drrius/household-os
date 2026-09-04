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
    throw new Error(result.error ?? "Couldn't upload the attachment.");
  return result.path;
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
      setError(
        failure instanceof Error
          ? failure.message
          : "Couldn't upload the attachment.",
      );
      setCanRetry(true);
      input.current?.setCustomValidity(
        "Retry, choose another file, or remove this attachment before saving.",
      );
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
