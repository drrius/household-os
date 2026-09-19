type WebCrypto = {
  randomUUID?: () => string;
  getRandomValues: (array: Uint8Array) => Uint8Array;
};

function webCrypto(): WebCrypto {
  const value = (globalThis as { crypto?: WebCrypto }).crypto;
  if (!value?.getRandomValues) {
    throw new Error("Secure random is required for idempotency keys.");
  }
  return value;
}

export function newIdempotencyKey(): string {
  const cryptoApi = webCrypto();
  if (typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
