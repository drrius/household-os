import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const storePath = resolve(process.cwd(), ".local", "vapid.json");

type VapidKeyPair = {
  publicKey: string;
  privateKey: string;
};

function toUrlBase64(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function generateVapidKeys(): VapidKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });

  const publicJwk = publicKey.export({ format: "jwk" });
  const privateJwk = privateKey.export({ format: "jwk" });
  if (
    typeof publicJwk.x !== "string" ||
    typeof publicJwk.y !== "string" ||
    typeof privateJwk.d !== "string"
  ) {
    throw new Error("Failed to export VAPID key material");
  }

  const x = Buffer.from(publicJwk.x, "base64url");
  const y = Buffer.from(publicJwk.y, "base64url");
  const uncompressed = Buffer.concat([Buffer.from([0x04]), x, y]);

  return {
    publicKey: toUrlBase64(uncompressed),
    privateKey: toUrlBase64(Buffer.from(privateJwk.d, "base64url")),
  };
}

function loadOrCreate(): VapidKeyPair {
  if (existsSync(storePath)) {
    const parsed = JSON.parse(
      readFileSync(storePath, "utf8"),
    ) as Partial<VapidKeyPair>;
    if (
      typeof parsed.publicKey === "string" &&
      parsed.publicKey.length > 0 &&
      typeof parsed.privateKey === "string" &&
      parsed.privateKey.length > 0
    ) {
      return { publicKey: parsed.publicKey, privateKey: parsed.privateKey };
    }
  }

  const keys = generateVapidKeys();
  mkdirSync(dirname(storePath), { recursive: true });
  writeFileSync(storePath, `${JSON.stringify(keys, null, 2)}\n`, {
    mode: 0o600,
  });
  return keys;
}

const keys = loadOrCreate();
process.stdout.write(
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n`,
);
