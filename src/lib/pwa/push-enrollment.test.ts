import { describe, expect, it } from "vitest";

import {
  detectPushEnrollment,
  serializePushSubscription,
  urlBase64ToUint8Array,
} from "./push-enrollment";

describe("urlBase64ToUint8Array", () => {
  it("decodes URL-safe base64 without padding", () => {
    const bytes = urlBase64ToUint8Array("AQID");
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });
});

describe("serializePushSubscription", () => {
  it("extracts endpoint and keys from a PushSubscription", () => {
    const subscription = {
      toJSON() {
        return {
          endpoint: "https://push.example/sub",
          keys: { p256dh: "pk", auth: "ak" },
        };
      },
    } as unknown as PushSubscription;

    expect(serializePushSubscription(subscription)).toEqual({
      endpoint: "https://push.example/sub",
      p256dh: "pk",
      auth: "ak",
    });
  });
});

describe("detectPushEnrollment", () => {
  it("reports unsupported when APIs are missing", async () => {
    const originalWorker = Reflect.get(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: globalThis,
    });

    await expect(detectPushEnrollment(null)).resolves.toEqual({
      status: "unsupported",
    });

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalWorker,
    });
  });
});
