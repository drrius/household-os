"use client";

import { useRef, useState } from "react";
import type { AttachmentPurpose } from "@/domain/attachments/files";
import { prepareAttachment } from "@/lib/attachments/prepare-image.client";

export function useAttachmentUpload(
  purpose: AttachmentPurpose,
  initialPath: string | null,
) {
  const input = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState(initialPath ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setPending(true);
    setError(null);
    input.current?.setCustomValidity(
      "Wait for the attachment to finish uploading.",
    );
    try {
      const prepared = await prepareAttachment(file);
      const form = new FormData();
      form.set("file", prepared);
      form.set("purpose", purpose);
      const response = await fetch("/api/attachments", {
        method: "POST",
        body: form,
      });
      const result: { path?: string; error?: string } = await response
        .json()
        .catch(() => ({}));
      if (!response.ok || !result.path)
        throw new Error(result.error ?? "Couldn't upload the attachment.");
      setPath(result.path);
      if (input.current) {
        input.current.value = "";
        input.current.setCustomValidity("");
      }
    } catch (failure) {
      const message =
        failure instanceof Error
          ? failure.message
          : "Couldn't upload the attachment.";
      setError(message);
      input.current?.setCustomValidity(
        "Choose another file or remove this attachment before saving.",
      );
    } finally {
      setPending(false);
    }
  }

  function remove() {
    setPath("");
    setError(null);
    if (input.current) {
      input.current.value = "";
      input.current.setCustomValidity("");
    }
  }
  return { input, path, pending, error, upload, remove };
}
