import { z } from "zod";

export const pushEndpointSchema = z
  .string()
  .max(4000)
  .url()
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Choose a valid push endpoint");
export const pushTestRequestSchema = z.object({
  endpoint: pushEndpointSchema,
  requestId: z.uuid(),
});
export const pushTestStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["queued", "accepted", "failed"]),
});
export type PushTestStatus = z.infer<typeof pushTestStatusSchema>;
export type PushStatusResult<T> =
  { ok: true; value: T } | { ok: false; error: string };

export type PushRegistrationResult =
  { ok: true } | { ok: false; error: string; reason?: "endpoint_owned" };
