import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createSupabaseIdentityAdminGateway,
  runIdentityAdmin,
} from "./lib/identity-admin.ts";

type LocalIdentityConfig = {
  household: string;
  appOrigin: string;
  projectUrl: string;
  members: Array<{ email: string; displayName: string }>;
};

const configPath = resolve(".local/identity.json");
const openBrowser = process.argv.includes("--open");

function readLocalIdentityConfig(): LocalIdentityConfig {
  let raw: string;

  try {
    raw = readFileSync(configPath, "utf8");
  } catch {
    throw new Error(
      `Missing ${configPath}. Copy .local/identity.example.json to .local/identity.json and fill in both members once.`,
    );
  }

  const parsed = JSON.parse(raw) as LocalIdentityConfig;

  if (
    typeof parsed.household !== "string" ||
    typeof parsed.appOrigin !== "string" ||
    typeof parsed.projectUrl !== "string" ||
    !Array.isArray(parsed.members) ||
    parsed.members.length !== 2
  ) {
    throw new Error(
      `${configPath} must include household, appOrigin, projectUrl, and exactly two members`,
    );
  }

  for (const member of parsed.members) {
    if (
      typeof member.email !== "string" ||
      typeof member.displayName !== "string"
    ) {
      throw new Error("Each member needs email and displayName strings");
    }
  }

  return parsed;
}

function readLocalSecretKey(): string {
  const result = spawnSync(
    "pnpm",
    ["exec", "supabase", "status", "-o", "env"],
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

  const match = /(?:^|\n)SECRET_KEY="([^"]+)"/.exec(result.stdout);

  if (match === null) {
    throw new Error("SECRET_KEY missing from supabase status -o env");
  }

  return match[1];
}

const config = readLocalIdentityConfig();
const secret = readLocalSecretKey();
const printedLinks: string[] = [];

await runIdentityAdmin(
  [
    "bootstrap",
    "--project-url",
    config.projectUrl,
    "--app-origin",
    config.appOrigin,
    "--household",
    config.household,
    "--member",
    `${config.members[0].email}:${config.members[0].displayName}`,
    "--member",
    `${config.members[1].email}:${config.members[1].displayName}`,
    "--secret-stdin",
  ],
  {
    createGateway: createSupabaseIdentityAdminGateway,
    readSecret: async () => secret,
    writeLine(line) {
      printedLinks.push(line);
      process.stdout.write(`${line}\n`);
    },
  },
);

process.stderr.write(
  "\nOpen an enroll link on http://localhost:3000, register a passkey, then sign in.\n",
);

if (openBrowser && printedLinks[0] !== undefined) {
  const opener =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  spawnSync(opener, [printedLinks[0]], {
    shell: process.platform === "win32",
    stdio: "ignore",
  });
}
