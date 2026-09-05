import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { classifyPath, SIGN_IN_PATH } from "@/lib/auth/paths";
import { safeReturnPath } from "@/lib/auth/return-path";
import { getPublicEnv } from "@/lib/env";

function applyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (
    process.env.HOUSEHOLD_OS_E2E_FIXTURES === "1" &&
    ["/m6-fixture/", "/m7-fixture/", "/assistant-fixture/"].some((prefix) =>
      request.nextUrl.pathname.startsWith(prefix),
    )
  ) {
    return response;
  }

  const env = getPublicEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        experimental: { passkey: true },
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value);
          }

          response = NextResponse.next({ request });

          for (const cookie of cookiesToSet) {
            response.cookies.set(cookie.name, cookie.value, cookie.options);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = data?.claims?.sub !== undefined;
  const pathClass = classifyPath(request.nextUrl.pathname);

  if (pathClass === "member" && !isAuthenticated) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = SIGN_IN_PATH;
    signInUrl.search = "";
    signInUrl.searchParams.set(
      "returnTo",
      safeReturnPath(`${request.nextUrl.pathname}${request.nextUrl.search}`),
    );
    const redirectResponse = NextResponse.redirect(signInUrl);
    applyCookies(response, redirectResponse);
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|household-os-sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
