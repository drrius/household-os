export type VapidPrivateJwk = {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
  d: string;
};

function decodeBase64Url(value: string, label: string): Uint8Array {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_-]+$/u.test(normalized)) {
    throw new Error(`${label} is not URL-safe base64`);
  }

  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(
    normalized.replaceAll("-", "+").replaceAll("_", "/") + padding,
  );
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function vapidKeysToPrivateJwk(
  publicKey: string,
  privateKey: string,
): VapidPrivateJwk {
  const publicBytes = decodeBase64Url(publicKey, "VAPID public key");
  const privateBytes = decodeBase64Url(privateKey, "VAPID private key");

  if (publicBytes.length !== 65 || publicBytes[0] !== 0x04) {
    throw new Error("VAPID public key must be an uncompressed P-256 point");
  }
  if (privateBytes.length !== 32) {
    throw new Error("VAPID private key must be a 32-byte P-256 scalar");
  }

  return {
    kty: "EC",
    crv: "P-256",
    x: encodeBase64Url(publicBytes.slice(1, 33)),
    y: encodeBase64Url(publicBytes.slice(33, 65)),
    d: encodeBase64Url(privateBytes),
  };
}
