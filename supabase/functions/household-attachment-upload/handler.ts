export class AttachmentAuthorizationFailure extends Error {
  constructor(readonly status: 401 | 403 | 503) {
    super(
      status === 401
        ? "Sign in again to upload a file."
        : status === 403
          ? "Join a household to upload a file."
          : "Couldn't verify your account. Please retry.",
    );
  }
}
export type UploadServices = {
  authorize: (token: string) => Promise<string | null>;
  inspect: (bytes: Uint8Array) => { extension: string; mime: string } | null;
  reserve: (
    path: string,
    mime: string,
  ) => Promise<{ data: unknown; error: unknown }>;
  upload: (
    path: string,
    bytes: Uint8Array,
    mime: string,
  ) => Promise<{ error: unknown }>;
};
const limit = 4 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function reply(status: number, body: object) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
async function boundedBytes(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
async function store(
  services: UploadServices,
  path: string,
  bytes: Uint8Array,
  mime: string,
) {
  const reservation = await services.reserve(path, mime);
  if (reservation.error) return reservationFailure(reservation.error);
  if (typeof reservation.data !== "boolean")
    return reply(503, { error: "Couldn't confirm this upload. Please retry." });
  if (reservation.data !== true) {
    const uploaded = await services.upload(path, bytes, mime);
    if (uploaded.error) {
      const recovered = await services.reserve(path, mime);
      if (recovered.error) return reservationFailure(recovered.error);
      if (recovered.data !== true)
        return reply(502, {
          error: "Couldn't upload the file. Please try again.",
        });
    }
  }
  return reply(201, { path });
}
export async function handleAttachmentUpload(
  request: Request,
  services: UploadServices,
) {
  if (request.method !== "POST")
    return reply(405, { error: "Method not allowed." });
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer "))
    return reply(401, { error: "Sign in to upload a file." });
  try {
    const household = await services.authorize(authorization.slice(7));
    if (!household || !uuid.test(household))
      return reply(403, { error: "Join a household to upload a file." });
    const url = new URL(request.url);
    const purpose = url.searchParams.get("purpose") ?? "";
    const uploadId = url.searchParams.get("uploadId") ?? "";
    if (
      !["receipts", "completions", "documents"].includes(purpose) ||
      !uuid.test(uploadId)
    )
      return reply(400, { error: "Choose the file again." });
    const bytes = await boundedBytes(request);
    if (!bytes)
      return reply(413, { error: "Choose a file smaller than 4 MB." });
    const type = services.inspect(bytes);
    if (!type || (purpose === "completions" && type.mime === "application/pdf"))
      return reply(400, {
        error: "Choose a supported photo or PDF smaller than 4 MB.",
      });
    const path = `${household}/${purpose}/${uploadId}.${type.extension}`;
    return await store(services, path, bytes, type.mime);
  } catch (error) {
    if (error instanceof AttachmentAuthorizationFailure)
      return reply(error.status, { error: error.message });
    return reply(502, { error: "Couldn't upload the file. Please try again." });
  }
}

function reservationFailure(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (code === "22023")
    return reply(409, { error: "This upload expired. Choose the file again." });
  if (["PGRST301", "PGRST302", "PGRST303"].includes(code))
    return reply(401, { error: "Sign in again to upload a file." });
  if (code === "42501" || code.startsWith("28"))
    return reply(403, { error: "This account cannot upload this attachment." });
  return reply(503, { error: "Couldn't confirm this upload. Please retry." });
}
