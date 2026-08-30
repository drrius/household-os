import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getBearerSession } from "@/lib/auth/bearer-context";
import { getPublicEnv } from "@/lib/env";

export async function createClient() {
  const bearer = getBearerSession();
  if (bearer !== null) {
    const env = getPublicEnv();
    // MCP bridge requests carry a member access token instead of cookies;
    // RLS sees the same authenticated member either way.
    return createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        global: {
          headers: { Authorization: `Bearer ${bearer.accessToken}` },
        },
        cookies: {
          getAll() {
            return [];
          },
          setAll() {
            // No cookie jar in bearer mode.
          },
        },
      },
    );
  }

  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        experimental: { passkey: true },
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const cookie of cookiesToSet) {
              cookieStore.set(cookie.name, cookie.value, cookie.options);
            }
          } catch {
            // Server Components cannot set cookies. A proxy refreshes sessions.
          }
        },
      },
    },
  );
}
