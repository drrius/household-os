import { beforeEach, expect, it, vi } from "vitest";
import {
  handleAttachmentUpload,
  type UploadServices,
} from "../../../supabase/functions/household-attachment-upload/handler";
import { attachmentFileType } from "@/domain/attachments/files";
const household = "00000000-0000-4000-8000-000000000001";
const id = "00000000-0000-4000-8000-000000000002";
const pdf = new TextEncoder().encode("%PDF-1.7\nfixture");
const services: UploadServices = {
  authorize: vi.fn(),
  inspect: attachmentFileType,
  reserve: vi.fn(),
  upload: vi.fn(),
};
function request(bytes = pdf, purpose = "receipts", authorized = true) {
  return new Request(
    `https://edge.example/?purpose=${purpose}&uploadId=${id}`,
    {
      method: "POST",
      headers: authorized
        ? {
            authorization: "Bearer fixture-token",
            "content-type": "image/jpeg",
          }
        : {},
      body: bytes,
    },
  );
}
beforeEach(() => {
  vi.mocked(services.authorize).mockReset().mockResolvedValue(household);
  vi.mocked(services.reserve)
    .mockReset()
    .mockResolvedValue({ data: false, error: null });
  vi.mocked(services.upload).mockReset().mockResolvedValue({ error: null });
});
it("requires verified identity and household membership before writing", async () => {
  expect(
    (await handleAttachmentUpload(request(pdf, "receipts", false), services))
      .status,
  ).toBe(401);
  expect(services.authorize).not.toHaveBeenCalled();
  vi.mocked(services.authorize).mockResolvedValue(null);
  expect((await handleAttachmentUpload(request(), services)).status).toBe(403);
  expect(services.reserve).not.toHaveBeenCalled();
  expect(services.upload).not.toHaveBeenCalled();
});
it("rejects PDF bytes disguised as a completion JPEG on the direct Edge endpoint", async () => {
  expect(
    (await handleAttachmentUpload(request(pdf, "completions"), services))
      .status,
  ).toBe(400);
  expect(services.upload).not.toHaveBeenCalled();
});
it("derives household, namespace, extension and MIME from verified identity and bytes", async () => {
  const response = await handleAttachmentUpload(request(), services);
  expect(response.status).toBe(201);
  expect(services.upload).toHaveBeenCalledWith(
    `${household}/receipts/${id}.pdf`,
    pdf,
    "application/pdf",
  );
});
it("rejects traversal and chunked oversized requests before reserving", async () => {
  expect(
    (await handleAttachmentUpload(request(pdf, "../completions"), services))
      .status,
  ).toBe(400);
  expect(
    (
      await handleAttachmentUpload(
        request(new Uint8Array(4 * 1024 * 1024 + 1)),
        services,
      )
    ).status,
  ).toBe(413);
  expect(services.reserve).not.toHaveBeenCalled();
});
it("recovers a lost response and never overwrites an existing object", async () => {
  vi.mocked(services.reserve).mockResolvedValue({ data: true, error: null });
  expect((await handleAttachmentUpload(request(), services)).status).toBe(201);
  expect(services.upload).not.toHaveBeenCalled();
});
it("does not resurrect expired uploads and recovers concurrent successful writes", async () => {
  vi.mocked(services.reserve).mockResolvedValueOnce({ data: null, error: {} });
  expect((await handleAttachmentUpload(request(), services)).status).toBe(409);
  expect(services.upload).not.toHaveBeenCalled();
  vi.mocked(services.upload).mockResolvedValue({ error: {} });
  vi.mocked(services.reserve)
    .mockResolvedValueOnce({ data: false, error: null })
    .mockResolvedValueOnce({ data: true, error: null });
  expect((await handleAttachmentUpload(request(), services)).status).toBe(201);
});
