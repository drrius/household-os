import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

export function localCiStatus(): Record<string, string> {
  if (process.env.GITHUB_ACTIONS !== "true")
    throw new Error(
      "Member acceptance runs only on the disposable GitHub Actions database.",
    );
  const result = spawnSync(
    "pnpm",
    ["exec", "supabase", "status", "-o", "json"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error("Local CI Supabase is unavailable.");
  const status = JSON.parse(result.stdout) as Record<string, string>;
  if (status.API_URL !== "http://127.0.0.1:54321")
    throw new Error("Member acceptance requires the local CI Supabase URL.");
  return status;
}

export async function bootstrapMembers(origin: string): Promise<string[]> {
  const status = localCiStatus();
  const secret = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Local CI admin key is unavailable.");
  const client = createClient(status.API_URL!, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const existing = await client.from("households").select("id").limit(1);
  if (existing.error || existing.data.length)
    throw new Error(
      "Member acceptance requires an empty disposable household database.",
    );
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "scripts/identity-admin.mts",
      "bootstrap",
      "--project-url",
      status.API_URL!,
      "--app-origin",
      origin,
      "--household",
      "CI acceptance household",
      "--member",
      "member-a@example.invalid:Alex",
      "--member",
      "member-b@example.invalid:Sam",
      "--secret-stdin",
    ],
    { encoding: "utf8", input: secret },
  );
  if (result.status !== 0) throw new Error("CI member bootstrap failed.");
  const links = result.stdout.trim().split("\n");
  if (
    links.length !== 2 ||
    links.some((link) => !link.startsWith(`${origin}/auth/consume?`))
  )
    throw new Error("Expected two member enrollment links.");
  return links;
}
