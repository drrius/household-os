import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const configPath = resolve("supabase/config.toml");
const config = readFileSync(configPath, "utf8");

function requireSetting(pattern: RegExp, label: string): string {
  const match = config.match(pattern);

  if (match?.[1] === undefined) {
    throw new Error(`Missing ${label} in supabase/config.toml`);
  }

  return match[1];
}

const rpId = requireSetting(/rp_id\s*=\s*"([^"]+)"/, "auth.webauthn.rp_id");
const passkeyEnabled = /\[auth\.passkey\][\s\S]*?enabled\s*=\s*true/.test(
  config,
);
const signupDisabled = /enable_signup\s*=\s*false/.test(config);

if (!passkeyEnabled) {
  throw new Error("auth.passkey.enabled must be true");
}

if (!signupDisabled) {
  throw new Error("auth.enable_signup must remain false");
}

const productionRpId = process.env.HOUSEHOLD_OS_WEBAUTHN_RP_ID;

if (productionRpId === undefined || productionRpId.length === 0) {
  if (rpId !== "localhost") {
    throw new Error(
      `Local config rp_id must be localhost unless HOUSEHOLD_OS_WEBAUTHN_RP_ID is set (found ${rpId})`,
    );
  }

  console.log(
    "WebAuthn gate: local rp_id=localhost; set HOUSEHOLD_OS_WEBAUTHN_RP_ID before production enrollment.",
  );
  process.exit(0);
}

if (productionRpId.includes("/") || productionRpId.includes(":")) {
  throw new Error(
    "HOUSEHOLD_OS_WEBAUTHN_RP_ID must be a bare hostname (no scheme, port, or path)",
  );
}

console.log(
  `WebAuthn gate: production RP ID ${productionRpId} must match the stable Vercel hostname before enrollment; local rp_id remains ${rpId}.`,
);
