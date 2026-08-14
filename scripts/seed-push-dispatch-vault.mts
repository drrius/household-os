import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

type LocalSupabaseStatus = {
  apiUrl?: string;
  serviceRoleKey?: string;
};

function readStdoutJsonObject(stdout: string): Record<string, unknown> {
  const start = stdout.lastIndexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("supabase status stdout did not contain a JSON object");
  }
  const parsed: unknown = JSON.parse(stdout.slice(start, end + 1));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("supabase status JSON was not an object");
  }
  return parsed as Record<string, unknown>;
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

  const parsed = readStdoutJsonObject(result.stdout);
  return {
    apiUrl: typeof parsed.API_URL === "string" ? parsed.API_URL : undefined,
    serviceRoleKey:
      typeof parsed.SERVICE_ROLE_KEY === "string"
        ? parsed.SERVICE_ROLE_KEY
        : undefined,
  };
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function upsertVaultSecret(name: string, secret: string): void {
  const sql = `
do $seed$
declare
  existing_id uuid;
begin
  select secrets.id
  into existing_id
  from vault.secrets as secrets
  where secrets.name = ${sqlLiteral(name)};

  if existing_id is null then
    perform vault.create_secret(
      ${sqlLiteral(secret)},
      ${sqlLiteral(name)},
      ${sqlLiteral(`Household OS ${name}`)}
    );
  else
    perform vault.update_secret(
      existing_id,
      ${sqlLiteral(secret)},
      ${sqlLiteral(name)},
      ${sqlLiteral(`Household OS ${name}`)}
    );
  end if;
end;
$seed$;
`;

  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_household-os",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(
      `vault seed failed for ${name}:\n${result.stderr || result.stdout}`,
    );
  }
}

function main(): void {
  if (existsSync(".env.local")) {
    loadEnvFile(".env.local");
  }

  const localStatus = readLocalSupabaseStatus();
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? localStatus.serviceRoleKey;
  if (!serviceRoleKey) {
    throw new Error("SERVICE_ROLE_KEY is required to seed push dispatch vault");
  }

  const dispatchUrl =
    process.env.PUSH_DISPATCH_URL ??
    "http://kong:8000/functions/v1/push-dispatch";

  upsertVaultSecret("push_dispatch_url", dispatchUrl);
  upsertVaultSecret("push_dispatch_service_role_key", serviceRoleKey);
  process.stdout.write("seeded push_dispatch vault secrets\n");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`seed-push-dispatch-vault: ${message}\n`);
  process.exitCode = 1;
}
