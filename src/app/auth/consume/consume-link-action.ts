"use server";

import { redirect } from "next/navigation";

import { AUTH_ERROR_PATH, SECURITY_PATH } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

function authErrorPath(reason: "malformed" | "rejected") {
  return `${AUTH_ERROR_PATH}?reason=${reason}`;
}

export async function consumeMagicLink(formData: FormData): Promise<void> {
  const tokenHash = formData.get("token_hash");
  const type = formData.get("type");

  if (
    typeof tokenHash !== "string" ||
    tokenHash.length === 0 ||
    type !== "magiclink"
  ) {
    redirect(authErrorPath("malformed"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });

  if (error) {
    redirect(authErrorPath("rejected"));
  }

  redirect(SECURITY_PATH);
}
