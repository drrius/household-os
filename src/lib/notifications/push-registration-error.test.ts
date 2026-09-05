import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  PushEndpointOwnedError,
  pushRegistrationError,
} from "./push-registration-error";

it("recognizes only the exact database ownership rejection", () => {
  expect(
    pushRegistrationError({
      code: "42501",
      message: "push endpoint belongs to another member",
    }),
  ).toBeInstanceOf(PushEndpointOwnedError);
  for (const error of [
    { code: "42501", message: "authentication required" },
    { code: "42501", message: "caller is not a household member" },
    {
      code: "42501",
      message: "permission denied for function register_push_subscription",
    },
    { code: "XX000", message: "push endpoint belongs to another member" },
    { message: "push endpoint belongs to another member" },
  ])
    expect(pushRegistrationError(error)).not.toBeInstanceOf(
      PushEndpointOwnedError,
    );
});
