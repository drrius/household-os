import { NextResponse, type NextRequest } from "next/server";

import { AUTH_ERROR_PATH, SECURITY_PATH } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

// The gate screen turns the reason into product copy; the identity provider's
// own message never leaves the server.
function authErrorRedirect(
  request: NextRequest,
  reason: "malformed" | "rejected",
) {
  return NextResponse.redirect(
    new URL(`${AUTH_ERROR_PATH}?reason=${reason}`, request.url),
  );
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (tokenHash === null || type !== "magiclink") {
    return authErrorRedirect(request, "malformed");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });

  if (error) {
    return authErrorRedirect(request, "rejected");
  }

  return NextResponse.redirect(new URL(SECURITY_PATH, request.url));
}
