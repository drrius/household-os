"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import type { PasskeySummary } from "@/lib/auth/passkeys";
import { createClient } from "@/lib/supabase/client";
import { ZURICH_TIME_ZONE } from "@/lib/ui/zurich-date";
import { EmptyState } from "@/ui/layout/empty-state";

const passkeyTimestampFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: ZURICH_TIME_ZONE,
});

function formatPasskeyTimestamp(timestamp: string): string {
  return passkeyTimestampFormatter.format(new Date(timestamp));
}

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

function PasskeyList({
  passkeys,
  pending,
  onRename,
  onRevoke,
}: {
  passkeys: PasskeySummary[];
  pending: boolean;
  onRename: (passkeyId: string, friendlyName: string) => void;
  onRevoke: (passkeyId: string) => void;
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
          key={passkey.id}
          passkey={passkey}
          pending={pending}
          onRename={(friendlyName) => {
            onRename(passkey.id, friendlyName);
          }}
          onRevoke={() => {
            onRevoke(passkey.id);
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
          <Button
            className="w-full"
            nativeButton={false}
            render={<Link href="/" />}
            variant="outline"
          >
            Continue to Today
          </Button>
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
    <section aria-labelledby="passkeys-heading" className="grid gap-4">
      <h2 className="font-heading text-lg font-semibold" id="passkeys-heading">
        Passkeys
      </h2>

      <PasskeyList
        passkeys={passkeys}
        pending={pending}
        onRename={(passkeyId, friendlyName) => {
          void runPasskeyAction(
            () => updatePasskeyName(passkeyId, friendlyName),
            "Unable to rename passkey",
          );
        }}
        onRevoke={revokePasskey}
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
    <Item
      className="flex-col items-stretch gap-4"
      render={<li />}
      variant="outline"
    >
      <ItemContent className="gap-1">
        <ItemTitle>
          {passkey.friendlyName?.trim() || "Unnamed passkey"}
        </ItemTitle>
        <ItemDescription>
          Created {formatPasskeyTimestamp(passkey.createdAt)}
          {passkey.lastUsedAt
            ? ` · Last used ${formatPasskeyTimestamp(passkey.lastUsedAt)}`
            : null}
        </ItemDescription>
      </ItemContent>

      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          onRename(String(formData.get("friendlyName") ?? "").trim());
        }}
      >
        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor={`passkey-name-${passkey.id}`}>Name</FieldLabel>
            <Input
              defaultValue={passkey.friendlyName ?? ""}
              id={`passkey-name-${passkey.id}`}
              maxLength={120}
              name="friendlyName"
              type="text"
            />
          </Field>
        </FieldGroup>

        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} type="submit" variant="outline">
            Rename
          </Button>
          <Button
            disabled={pending}
            onClick={onRevoke}
            type="button"
            variant="destructive"
          >
            Revoke
          </Button>
        </div>
      </form>
    </Item>
  );
}
