"use server";

import { revalidatePath } from "next/cache";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

export type SignOutResult =
  { ok: true; pushPaused?: boolean } | { ok: false; error: string };

export async function signOutThisDevice(
  endpoint: string | null,
): Promise<SignOutResult> {
  await requireMemberContext();
  if (
    endpoint !== null &&
    (typeof endpoint !== "string" ||
      endpoint.length === 0 ||
      endpoint.length > 4000)
  ) {
    return {
      ok: false,
      error: "Could not identify this device. Reload Security and try again.",
    };
  }
  const client = await createClient();
  let pushPaused = false;
  {
    const { data, error } =
      endpoint === null
        ? await client.rpc("pause_my_push_for_signout")
        : await client.rpc("unregister_push_subscription", {
            p_endpoint: endpoint,
          });
    pushPaused =
      endpoint === null &&
      typeof data?.disabled === "number" &&
      data.disabled > 0;
    if (error)
      return {
        ok: false,
        error:
          "Could not turn off this device’s notifications. Try signing out again.",
      };
  }
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error)
    return {
      ok: false,
      error: "Could not sign out. Check your connection and try again.",
    };
  revalidatePath("/", "layout");
  return pushPaused ? { ok: true, pushPaused: true } : { ok: true };
}
