import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env";
import { cleanupAttachments } from "./cleanup";

export async function uploadAttachment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
  bytes: Uint8Array,
  mime: string,
): Promise<
  { status: number; path: string } | { status: number; error: string }
> {
  await cleanupAttachments(supabase).catch(() => false);
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { status: 401, error: "Sign in to upload a file." };
  const env = getPublicEnv();
  const url = new URL(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/household-attachment-upload`,
  );
  url.searchParams.set("purpose", path.split("/")[1] ?? "");
  url.searchParams.set("uploadId", path.split("/")[2]?.split(".")[0] ?? "");
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": mime,
      },
      body: new Uint8Array(bytes),
      cache: "no-store",
    });
    const result = await response.json();
    if (response.ok && result.path === path) return { status: 201, path };
    const status = [400, 401, 403, 409, 413, 429].includes(response.status)
      ? response.status
      : 502;
    return {
      status,
      error:
        status === 409
          ? "This upload expired. Choose the file again."
          : "Couldn't upload the file. Choose it again or try later.",
    };
  } catch {
    return {
      status: 502,
      error: "Couldn't upload the file. Please try again.",
    };
  }
}
