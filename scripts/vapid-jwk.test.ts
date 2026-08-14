import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";

import { vapidKeysToPrivateJwk } from "../supabase/functions/_shared/vapid-jwk.ts";

function toUrlBase64(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

describe("vapidKeysToPrivateJwk", () => {
  it("round-trips a P-256 key pair into an importable private JWK", () => {
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

    const uncompressed = Buffer.concat([
      Buffer.from([0x04]),
      Buffer.from(publicJwk.x, "base64url"),
      Buffer.from(publicJwk.y, "base64url"),
    ]);
    const converted = vapidKeysToPrivateJwk(
      toUrlBase64(uncompressed),
      toUrlBase64(Buffer.from(privateJwk.d, "base64url")),
    );

    expect(converted).toEqual({
      kty: "EC",
      crv: "P-256",
      x: publicJwk.x,
      y: publicJwk.y,
      d: privateJwk.d,
    });
  });

  it("rejects a public key that is not an uncompressed point", () => {
    expect(() =>
      vapidKeysToPrivateJwk(
        "AAAA",
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      ),
    ).toThrow(/uncompressed P-256 point/u);
  });
});
