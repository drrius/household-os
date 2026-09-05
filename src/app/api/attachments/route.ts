import {
  ATTACHMENT_BUCKET,
  ATTACHMENT_PURPOSES,
  attachmentFileType,
  isHouseholdAttachment,
  MAX_ATTACHMENT_BYTES,
} from "@/domain/attachments/files";
import { uploadAttachment } from "@/lib/attachments/upload";
import { cleanupAttachments } from "@/lib/attachments/cleanup";
import { getMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

const headers = { "Cache-Control": "private, no-store" };

async function readUploadForm(request: Request): Promise<FormData | null> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("No request body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > MAX_ATTACHMENT_BYTES + 65536) {
      await reader.cancel();
      return null;
    }
    chunks.push(chunk.value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Response(body, {
    headers: { "Content-Type": request.headers.get("content-type") ?? "" },
  }).formData();
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json(
      { error: "Open Household OS to upload a file." },
      { status: 403, headers },
    );
  }
  const member = await getMemberContext();
  if (!member)
    return Response.json(
      { error: "Sign in to upload a file." },
      { status: 401, headers },
    );
  try {
    const form = await readUploadForm(request);
    if (!form)
      return Response.json(
        { error: "Choose a file smaller than 4 MB." },
        { status: 413, headers },
      );
    const file = form.get("file");
    const purpose = form.get("purpose");
    if (
      !(file instanceof File) ||
      !ATTACHMENT_PURPOSES.some((value) => value === purpose)
    ) {
      return Response.json(
        { error: "Choose a photo or PDF." },
        { status: 400, headers },
      );
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = attachmentFileType(bytes);
    if (
      !type ||
      (purpose === "completions" && type.mime === "application/pdf")
    ) {
      return Response.json(
        { error: "Choose a supported photo or PDF smaller than 4 MB." },
        { status: 400, headers },
      );
    }
    const uploadId = form.get("uploadId");
    if (
      typeof uploadId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        uploadId,
      )
    )
      return Response.json(
        { error: "Choose the file again." },
        { status: 400, headers },
      );
    const path = `${member.householdId}/${purpose}/${uploadId}.${type.extension}`;
    const result = await uploadAttachment(
      await createClient(),
      path,
      bytes,
      type.mime,
    );
    return Response.json(result, { status: result.status, headers });
  } catch {
    return Response.json(
      { error: "Couldn't read this file. Please try again." },
      { status: 400, headers },
    );
  }
}

export async function GET(request: Request) {
  const member = await getMemberContext();
  if (!member)
    return new Response("Sign in to view this attachment.", {
      status: 401,
      headers,
    });
  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!isHouseholdAttachment(path, member.householdId))
    return new Response("Attachment not found.", { status: 404, headers });
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, 60, { download: true });
  if (error || !data)
    return new Response("Attachment not found.", { status: 404, headers });
  return new Response(null, {
    status: 303,
    headers: { ...headers, Location: data.signedUrl },
  });
}

export async function DELETE(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response(null, { status: 403, headers });
  const member = await getMemberContext();
  if (!member) return new Response(null, { status: 401, headers });
  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!isHouseholdAttachment(path, member.householdId))
    return new Response(null, { status: 404, headers });
  try {
    const cleaned = await cleanupAttachments(await createClient(), path);
    return new Response(null, { status: cleaned ? 204 : 502, headers });
  } catch {
    return new Response(null, { status: 502, headers });
  }
}
