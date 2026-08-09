import { NextResponse, type NextRequest } from "next/server";

import { AUTH_ERROR_PATH, SECURITY_PATH } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (tokenHash === null || type !== "magiclink") {
    return NextResponse.redirect(new URL(AUTH_ERROR_PATH, request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });

  if (error) {
    return NextResponse.redirect(new URL(AUTH_ERROR_PATH, request.url));
  }

  return NextResponse.redirect(new URL(SECURITY_PATH, request.url));
}
