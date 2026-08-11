"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PasskeySummary } from "@/lib/auth/passkeys";
import { createClient } from "@/lib/supabase/client";

async function listPasskeys(): Promise<PasskeySummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.passkey.list();

  if (error) {
    throw error;
  }

  return (data ?? []).map((passkey) => ({
    id: passkey.id,
    friendlyName: passkey.friendly_name ?? null,
    createdAt: passkey.created_at,
    lastUsedAt: passkey.last_used_at ?? null,
  }));
}

async function registerPasskeyOnDevice() {
  const supabase = createClient();
  const { error } = await supabase.auth.registerPasskey();

  if (error) {
    throw error;
  }
}

async function updatePasskeyName(passkeyId: string, friendlyName: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.passkey.update({
    passkeyId,
    friendlyName,
  });

  if (error) {
    throw error;
  }
}

async function deletePasskey(passkeyId: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.passkey.delete({ passkeyId });

  if (error) {
    throw error;
  }
}

function confirmRevoke(isLastPasskey: boolean) {
  return window.confirm(
    isLastPasskey
      ? "This is your last passkey. Revoking it means the household administrator must run recover-link before you can sign in again. Continue?"
      : "Revoke this passkey?",
  );
}

export function PasskeyManager({
  initialPasskeys,
}: {
  initialPasskeys: PasskeySummary[];
}) {
  const router = useRouter();
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function runPasskeyAction(
    action: () => Promise<void>,
    fallbackMessage: string,
  ) {
    setPending(true);
    setErrorMessage(null);

    try {
      await action();
      setPasskeys(await listPasskeys());
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : fallbackMessage);
    } finally {
      setPending(false);
    }
  }

  function revokePasskey(passkeyId: string) {
    if (!confirmRevoke(passkeys.length <= 1)) {
      return;
    }

    void runPasskeyAction(
      () => deletePasskey(passkeyId),
      "Unable to revoke passkey",
    );
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
            <PasskeyItem
              key={passkey.id}
              passkey={passkey}
              pending={pending}
              onRename={(friendlyName) => {
                void runPasskeyAction(
                  () => updatePasskeyName(passkey.id, friendlyName),
                  "Unable to rename passkey",
                );
              }}
              onRevoke={() => {
                revokePasskey(passkey.id);
              }}
            />
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          void runPasskeyAction(
            registerPasskeyOnDevice,
            "Unable to register passkey",
          );
        }}
      >
        Register a passkey on this device
      </button>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
    </section>
  );
}

function PasskeyItem({
  passkey,
  pending,
  onRename,
  onRevoke,
}: {
  passkey: PasskeySummary;
  pending: boolean;
  onRename: (friendlyName: string) => void;
  onRevoke: () => void;
}) {
  return (
    <li>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          onRename(String(formData.get("friendlyName") ?? "").trim());
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
        {passkey.lastUsedAt ? <p>Last used {passkey.lastUsedAt}</p> : null}
        <button type="submit" disabled={pending}>
          Rename
        </button>
        <button type="button" disabled={pending} onClick={onRevoke}>
          Revoke
        </button>
      </form>
    </li>
  );
}
