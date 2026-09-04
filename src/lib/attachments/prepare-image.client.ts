"use client";

import { MAX_ATTACHMENT_BYTES } from "@/domain/attachments/files";

export async function prepareAttachment(file: File): Promise<File> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_ATTACHMENT_BYTES)
      throw new Error("Choose a PDF smaller than 4 MB.");
    return file;
  }
  if (!file.type.startsWith("image/"))
    throw new Error("Choose a photo or PDF.");
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2000 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Couldn't prepare this photo. Try another image.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error("Couldn't prepare this photo.")),
        "image/jpeg",
        0.85,
      );
    });
    if (blob.size > MAX_ATTACHMENT_BYTES)
      throw new Error("This photo is too large. Choose a smaller image.");
    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } finally {
    image.close();
  }
}
