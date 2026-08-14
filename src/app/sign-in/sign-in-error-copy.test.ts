import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  classifySignInError,
  describeSignInError,
  SIGN_IN_ERROR_COPY,
} from "./sign-in-error-copy";

const PRODUCT_COPY = Object.values(SIGN_IN_ERROR_COPY);

describe("sign-in failure copy", () => {
  it("treats a dismissed or timed-out prompt as a cancellation", () => {
    expect(
      classifySignInError({
        name: "NotAllowedError",
        message:
          "The operation either timed out or was not allowed. See: https://www.w3.org/TR/webauthn-2/#sctn-privacy-considerations-client.",
      }),
    ).toBe("cancelled");
  });

  it("recognises a browser without WebAuthn", () => {
    expect(
      classifySignInError({
        name: "AuthUnknownError",
        message: "Browser does not support WebAuthn",
      }),
    ).toBe("unsupported");
  });

  it("falls back to the generic sentence for server failures", () => {
    expect(
      classifySignInError({
        name: "AuthApiError",
        message: "Database error granting user",
      }),
    ).toBe("unknown");
  });

  it("survives errors that are not objects", () => {
    expect(describeSignInError(null)).toBe(SIGN_IN_ERROR_COPY.unknown);
    expect(describeSignInError("boom")).toBe(SIGN_IN_ERROR_COPY.unknown);
  });

  it("never returns anything but product copy", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (name, message) => {
        expect(PRODUCT_COPY).toContain(describeSignInError({ name, message }));
      }),
    );
  });
});
