"use client";

import { useRef } from "react";
import { SignInForm } from "@/app/sign-in/sign-in-form";
import { SignOutControl } from "@/app/security/sign-out-control";

export function AccountFixture({
  screen,
  returnTo,
}: {
  screen: string;
  returnTo: string;
}) {
  const attempts = useRef(0);
  if (screen === "sign-out" || screen === "sign-out-fallback")
    return (
      <SignOutControl
        action={async (endpoint) => {
          sessionStorage.setItem(
            "account-fixture-endpoint",
            endpoint ?? "none",
          );
          attempts.current += 1;
          return attempts.current === 1
            ? {
                ok: false,
                error: "This fixture rejected the first sign-out. Try again.",
              }
            : {
                ok: true,
                pushPaused: screen === "sign-out-fallback" && endpoint === null,
              };
        }}
      />
    );
  return (
    <SignInForm
      returnTo={returnTo}
      authenticate={(signal) =>
        new Promise((resolve) => {
          attempts.current += 1;
          const finish = () =>
            resolve({
              error:
                attempts.current === 1
                  ? new Error("Fixture passkey attempt rejected")
                  : null,
            });
          if (screen !== "cancel") setTimeout(finish, 250);
          signal.addEventListener("abort", () => resolve({ error: null }), {
            once: true,
          });
        })
      }
    />
  );
}
