import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { CalendarError } from "./errors";

const credentialSchema = z.object({
  username: z.string().email().max(254),
  password: z.string().regex(/^[a-z]{4}(?:-[a-z]{4}){3}$/i),
});
export type CalendarCredentials = z.infer<typeof credentialSchema>;
function encryptionKey(): Buffer {
  const encoded = process.env.HOUSEHOLD_CALENDAR_ENCRYPTION_KEY ?? "";
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) {
    throw new CalendarError(
      "invalid",
      "Calendar connection needs a server encryption key. Follow the setup instructions below.",
    );
  }
  return key;
}
export function calendarEncryptionConfigured(): boolean {
  try {
    encryptionKey();
    return true;
  } catch {
    return false;
  }
}
export function validateCredentials(
  username: string,
  password: string,
): CalendarCredentials {
  const parsed = credentialSchema.safeParse({
    username: username.trim(),
    password: password.trim(),
  });
  if (!parsed.success)
    throw new CalendarError(
      "invalid",
      "Enter your Apple Account email and an app-specific password (xxxx-xxxx-xxxx-xxxx).",
    );
  return parsed.data;
}
export function encryptCredentials(
  credentials: CalendarCredentials,
  householdId: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(householdId));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}
export function decryptCredentials(
  payload: string,
  householdId: string,
): CalendarCredentials {
  const key = encryptionKey();
  try {
    const [version, iv, tag, data, ...extra] = payload.split(".");
    if (version !== "v1" || !iv || !tag || !data || extra.length)
      throw new Error("Invalid envelope");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "base64"),
    );
    decipher.setAAD(Buffer.from(householdId));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    const text = Buffer.concat([
      decipher.update(Buffer.from(data, "base64")),
      decipher.final(),
    ]).toString("utf8");
    return credentialSchema.parse(JSON.parse(text));
  } catch {
    throw new CalendarError(
      "authentication",
      "The saved calendar connection cannot be unlocked. Reconnect with a new app-specific password.",
    );
  }
}
