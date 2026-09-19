import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

// The native module is the platform boundary; Hermes has no browser Web Crypto.
vi.mock("expo-crypto", () => ({ randomUUID }));

import { newIdempotencyKey } from "./idempotency";

afterEach(() => vi.unstubAllGlobals());

describe("native idempotency keys", () => {
  it("creates unique UUIDs without browser crypto during screen startup", () => {
    vi.stubGlobal("crypto", undefined);

    const keys = Array.from({ length: 100 }, () => newIdempotencyKey());

    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });
});
