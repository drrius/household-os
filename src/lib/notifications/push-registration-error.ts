import "server-only";

export class PushEndpointOwnedError extends Error {
  constructor() {
    super("This browser subscription belongs to another account.");
  }
}

export function pushRegistrationError(error: {
  code?: string;
  message: string;
}): Error {
  if (
    error.code === "42501" &&
    error.message === "push endpoint belongs to another member"
  ) {
    return new PushEndpointOwnedError();
  }
  return new Error(`register_push_subscription failed: ${error.message}`);
}
