"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PasskeySummary } from "@/lib/auth/passkeys";
import { createClient } from "@/lib/supabase/client";

export function PasskeyManager({
  initialPasskeys,
}: {
  initialPasskeys: PasskeySummary[];
}) {
  const router = useRouter();
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function refreshPasskeys() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.passkey.list();

    if (error) {
      throw error;
    }

    setPasskeys(
      (data ?? []).map((passkey) => ({
        id: passkey.id,
        friendlyName: passkey.friendly_name ?? null,
        createdAt: passkey.created_at,
        lastUsedAt: passkey.last_used_at ?? null,
      })),
    );
    router.refresh();
  }

  async function registerPasskey() {
    setPending(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.registerPasskey();

      if (error) {
        throw error;
      }

      await refreshPasskeys();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to register passkey",
      );
    } finally {
      setPending(false);
    }
  }

  async function renamePasskey(passkeyId: string, friendlyName: string) {
    setPending(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.passkey.update({
        passkeyId,
        friendlyName,
      });

      if (error) {
        throw error;
      }

      await refreshPasskeys();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to rename passkey",
      );
    } finally {
      setPending(false);
    }
  }

  async function revokePasskey(passkeyId: string) {
    const remaining = passkeys.length;

    const confirmed = window.confirm(
      remaining <= 1
        ? "This is your last passkey. Revoking it means the household administrator must run recover-link before you can sign in again. Continue?"
        : "Revoke this passkey?",
    );

    if (!confirmed) {
      return;
    }

    setPending(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.passkey.delete({ passkeyId });

      if (error) {
        throw error;
      }

      await refreshPasskeys();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to revoke passkey",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="passkeys-heading">
      <h2 id="passkeys-heading">Passkeys</h2>
      {passkeys.length === 0 ? (
        <p>
          No passkeys yet. Register one on this device to finish enrollment.
        </p>
      ) : (
        <ul>
          {passkeys.map((passkey) => (
            <li key={passkey.id}>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  const friendlyName = String(
                    formData.get("friendlyName") ?? "",
                  ).trim();
                  void renamePasskey(passkey.id, friendlyName);
                }}
              >
                <label>
                  Name
                  <input
                    name="friendlyName"
                    defaultValue={passkey.friendlyName ?? ""}
                    maxLength={120}
                  />
                </label>
                <p>Created {passkey.createdAt}</p>
                {passkey.lastUsedAt ? (
                  <p>Last used {passkey.lastUsedAt}</p>
                ) : null}
                <button type="submit" disabled={pending}>
                  Rename
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    void revokePasskey(passkey.id);
                  }}
                >
                  Revoke
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          void registerPasskey();
        }}
      >
        Register a passkey on this device
      </button>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
    </section>
  );
}
