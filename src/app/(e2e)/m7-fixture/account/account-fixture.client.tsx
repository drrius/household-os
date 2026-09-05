"use client";

import { useCallback, useRef } from "react";
import { SignInForm } from "@/app/sign-in/sign-in-form";
import { PasskeyLoader } from "@/app/security/passkey-loader.client";
import { SignOutControl } from "@/app/security/sign-out-control";

export function AccountFixture({
  screen,
  returnTo,
}: {
  screen: string;
  returnTo: string;
}) {
  const attempts = useRef(0);
  if (
    screen === "sign-out" ||
    screen === "sign-out-fallback" ||
    screen === "sign-out-partner"
  )
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
                pushPaused: screen === "sign-out-fallback" && endpoint === null,
              }
            : {
                ok: true,
                unsubscribe: screen !== "sign-out-partner" && endpoint !== null,
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

export function UnavailablePasskeysFixture({ pending }: { pending: boolean }) {
  const restored = useRef(false);
  const load = useCallback(async () => {
    if (pending) return new Promise<never>(() => {});
    if (!restored.current)
      throw new Error("Fixture passkey endpoint unavailable");
    return [
      {
        id: "00000000-0000-4000-8000-000000000901",
        friendlyName: "Recovery authenticator",
        createdAt: "2026-09-01T12:00:00Z",
        lastUsedAt: null,
      },
    ];
  }, [pending]);
  return (
    <div className="grid gap-3">
      <PasskeyLoader load={load} />
      {!pending ? (
        <button
          type="button"
          onClick={() => {
            restored.current = true;
          }}
        >
          Restore fixture passkey service
        </button>
      ) : null}
    </div>
  );
}
