import "server-only";

import { redirect } from "next/navigation";
import { z } from "zod";

/** A creation URL identifies one attempt across reloads and uncertain responses. */
export function requireCreationId(
  draft: string | string[] | undefined,
  pathname: string,
): string {
  const parsed = z.uuid().safeParse(draft);
  if (parsed.success) return parsed.data.toLowerCase();
  redirect(`${pathname}?draft=${crypto.randomUUID()}`);
}
