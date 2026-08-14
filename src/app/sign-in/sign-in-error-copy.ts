// The passkey SDK deliberately passes browser text straight through for the
// commonest failure (the member dismisses or times out the prompt), which in
// Chrome includes a w3.org specification URL. Gate screens only ever show one
// of the product sentences below; the raw text stays out of the DOM.
export const SIGN_IN_ERROR_COPY = {
  cancelled:
    "No passkey was used. Try again, or ask the person who set up Our Home for a one-time enrollment link.",
  unsupported:
    "This browser can't use passkeys. Open Our Home in Safari or Chrome on a device with a screen lock.",
  unknown:
    "Sign-in could not be completed. Try again, or ask the person who set up Our Home for a one-time enrollment link.",
} as const;

export type SignInFailure = keyof typeof SIGN_IN_ERROR_COPY;

const UNSUPPORTED_PATTERN = /does not support webauthn|not ?supported/i;
const CANCELLED_PATTERN =
  /not ?allowed|cancel|timed out|timeout|abort|denied by the user/i;

function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function describeThrown(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return readText(error);
  }

  const candidate = error as { message?: unknown; name?: unknown };
  return `${readText(candidate.name)} ${readText(candidate.message)}`;
}

export function classifySignInError(error: unknown): SignInFailure {
  const text = describeThrown(error);

  if (UNSUPPORTED_PATTERN.test(text)) {
    return "unsupported";
  }

  if (CANCELLED_PATTERN.test(text)) {
    return "cancelled";
  }

  return "unknown";
}

export function describeSignInError(error: unknown): string {
  return SIGN_IN_ERROR_COPY[classifySignInError(error)];
}
