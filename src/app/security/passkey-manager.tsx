"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  LAST_PASSKEY_LOCKOUT_COPY,
  PasskeyItem,
  passkeyItemKey,
  passkeyLabel,
} from "@/app/security/passkey-item";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ItemGroup } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import type { PasskeySummary } from "@/lib/auth/passkeys";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/ui/layout/empty-state";

export async function listPasskeys(): Promise<PasskeySummary[]> {
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

function PasskeyList({
  isLastPasskey,
  passkeys,
  pending,
  onRename,
  onRevoke,
}: {
  isLastPasskey: boolean;
  passkeys: PasskeySummary[];
  pending: boolean;
  onRename: (passkeyId: string, friendlyName: string) => void;
  onRevoke: (passkey: PasskeySummary) => void;
}) {
  if (passkeys.length === 0) {
    return (
      <EmptyState title="No passkeys yet">
        Register one on this device to finish enrollment.
      </EmptyState>
    );
  }

  return (
    <ItemGroup className="gap-3">
      {passkeys.map((passkey) => (
        <PasskeyItem
          key={passkeyItemKey(passkey)}
          isLastPasskey={isLastPasskey}
          passkey={passkey}
          pending={pending}
          onRename={(friendlyName) => {
            onRename(passkey.id, friendlyName);
          }}
          onRevoke={() => {
            onRevoke(passkey);
          }}
        />
      ))}
    </ItemGroup>
  );
}

function PasskeyManagerActions({
  errorMessage,
  hasPasskeys,
  pending,
  onRegister,
}: {
  errorMessage: string | null;
  hasPasskeys: boolean;
  pending: boolean;
  onRegister: () => void;
}) {
  return (
    <>
      <Button
        className="w-full"
        disabled={pending}
        onClick={onRegister}
        type="button"
      >
        Register a passkey on this device
      </Button>

      {hasPasskeys ? (
        <>
          <Separator />
          <Link
            className={buttonVariants({
              className: "w-full no-underline",
              variant: "outline",
            })}
            href="/"
          >
            Continue to Today
          </Link>
        </>
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Passkey action failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}

function RevokeConfirmDialog({
  isLastPasskey,
  target,
  onCancel,
  onConfirm,
}: {
  isLastPasskey: boolean;
  target: PasskeySummary | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      confirmLabel="Revoke passkey"
      confirmVariant="destructive"
      description={
        isLastPasskey
          ? LAST_PASSKEY_LOCKOUT_COPY
          : "This device will no longer be able to sign in with this passkey."
      }
      onConfirm={onConfirm}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      open={target !== null}
      title={`Revoke “${passkeyLabel(target)}”?`}
    />
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
  const [revokeTarget, setRevokeTarget] = useState<PasskeySummary | null>(null);

  // ADR 0022 lets a member revoke any passkey, so the consequence is stated
  // rather than blocked.
  const isLastPasskey = passkeys.length <= 1;

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

  function confirmRevoke() {
    if (revokeTarget === null) {
      return;
    }

    const { id } = revokeTarget;
    setRevokeTarget(null);
    void runPasskeyAction(() => deletePasskey(id), "Unable to revoke passkey");
  }

  return (
    <section aria-labelledby="passkeys-heading" className="grid gap-4">
      <h2 className="font-heading text-lg font-semibold" id="passkeys-heading">
        Passkeys
      </h2>

      <PasskeyList
        isLastPasskey={isLastPasskey}
        passkeys={passkeys}
        pending={pending}
        onRename={(passkeyId, friendlyName) => {
          void runPasskeyAction(
            () => updatePasskeyName(passkeyId, friendlyName),
            "Unable to rename passkey",
          );
        }}
        onRevoke={(passkey) => {
          setRevokeTarget(passkey);
        }}
      />

      <PasskeyManagerActions
        errorMessage={errorMessage}
        hasPasskeys={passkeys.length > 0}
        pending={pending}
        onRegister={() => {
          void runPasskeyAction(
            registerPasskeyOnDevice,
            "Unable to register passkey",
          );
        }}
      />

      <RevokeConfirmDialog
        isLastPasskey={isLastPasskey}
        target={revokeTarget}
        onCancel={() => {
          setRevokeTarget(null);
        }}
        onConfirm={confirmRevoke}
      />
    </section>
  );
}
