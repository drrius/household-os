import { z } from "zod";
import type { AiToolDefinition } from "./schemas";
export const attachmentSchemas = {
  get_attachment_link: z.object({ path: z.string().min(1).max(300) }),
  get_attachment_usage: z.object({}),
  clean_unused_attachment: z.object({ path: z.string().min(1).max(300) }),
};
export const ATTACHMENT_TOOLS: readonly AiToolDefinition[] = [
  {
    name: "get_attachment_link",
    kind: "read",
    inputSchema: attachmentSchemas.get_attachment_link,
    description:
      "Return an authenticated app link for a real household file path from a document, receipt or completion lookup. Verifies access; does not read file contents. Never invent paths. Uploading a new file requires the member's file picker.",
  },
  {
    name: "get_attachment_usage",
    kind: "read",
    inputSchema: attachmentSchemas.get_attachment_usage,
    description:
      "Read household attachment storage usage and limits. Unavailable usage is not zero.",
  },
  {
    name: "clean_unused_attachment",
    kind: "write",
    inputSchema: attachmentSchemas.clean_unused_attachment,
    description:
      "Ask the existing cleanup workflow to remove one unused upload when requested. Saved or linked files are protected and remain untouched. Use a real path; cleanup completion does not mean a linked file was deleted.",
  },
];
