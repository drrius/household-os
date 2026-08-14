import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

type LocalSupabaseStatus = {
  apiUrl?: string;
  serviceRoleKey?: string;
};

function extractLastJsonObject(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    throw new Error("supabase status returned empty stdout");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Supabase may print non-JSON noise before the object on stdout.
  }

  for (
    let index = trimmed.lastIndexOf("{");
    index >= 0;
    index = index === 0 ? -1 : trimmed.lastIndexOf("{", index - 1)
  ) {
    try {
      return JSON.parse(trimmed.slice(index));
    } catch {
      // Try an earlier object candidate on stdout.
    }
  }

  throw new Error("supabase status returned no JSON object on stdout");
}

function readLocalSupabaseStatus(): LocalSupabaseStatus {
  const result = spawnSync(
    "pnpm",
    ["exec", "supabase", "status", "-o", "json"],
    {
      encoding: "utf8",
      shell: process.platform === "win32",
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `supabase status failed:\n${result.stderr || result.stdout}`,
    );
  }

  const parsed = extractLastJsonObject(result.stdout);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("supabase status returned invalid JSON");
  }

  const apiUrl =
    "API_URL" in parsed && typeof parsed.API_URL === "string"
      ? parsed.API_URL
      : undefined;
  const serviceRoleKey =
    "SERVICE_ROLE_KEY" in parsed && typeof parsed.SERVICE_ROLE_KEY === "string"
      ? parsed.SERVICE_ROLE_KEY
      : undefined;

  return { apiUrl, serviceRoleKey };
}

async function main(): Promise<void> {
  if (existsSync(".env.local")) {
    loadEnvFile(".env.local");
  }

  let supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    const localStatus = readLocalSupabaseStatus();
    supabaseUrl ||= localStatus.apiUrl;
    serviceRoleKey ||= localStatus.serviceRoleKey;
  }

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  }

  const endpoint = new URL(
    "functions/v1/push-dispatch",
    `${supabaseUrl.replace(/\/+$/u, "")}/`,
  );
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const responseText = await response.text();
  let responseBody: unknown;

  try {
    responseBody = JSON.parse(responseText);
  } catch {
    responseBody = {
      error: responseText || `push-dispatch returned HTTP ${response.status}`,
    };
  }

  process.stdout.write(`${JSON.stringify(responseBody, null, 2)}\n`);
  if (!response.ok) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`drain-push: ${message}\n`);
  process.exitCode = 1;
}
