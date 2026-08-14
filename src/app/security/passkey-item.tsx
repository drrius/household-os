"use client";

import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import type { PasskeySummary } from "@/lib/auth/passkeys";
import { formatZurichTimestamp } from "@/lib/ui/zurich-date";

export const LAST_PASSKEY_LOCKOUT_COPY =
  "Revoking it will lock you out until a new enrollment link is issued. Register a passkey on another device first.";

export function passkeyLabel(passkey: PasskeySummary | null): string {
  return passkey?.friendlyName?.trim() || "Unnamed passkey";
}

// The caller keys the item on this, so the name field resynchronises whenever
// the stored name changes without discarding an in-flight edit.
export function passkeyItemKey(passkey: PasskeySummary): string {
  return `${passkey.id}:${passkey.friendlyName ?? ""}`;
}

function PasskeyHeadline({ passkey }: { passkey: PasskeySummary }) {
  return (
    <ItemContent className="gap-1">
      <ItemTitle>{passkeyLabel(passkey)}</ItemTitle>
      <ItemDescription>
        Created {formatZurichTimestamp(passkey.createdAt)}
        {passkey.lastUsedAt
          ? ` · Last used ${formatZurichTimestamp(passkey.lastUsedAt)}`
          : null}
      </ItemDescription>
    </ItemContent>
  );
}

export function PasskeyItem({
  isLastPasskey,
  passkey,
  pending,
  onRename,
  onRevoke,
}: {
  isLastPasskey: boolean;
  passkey: PasskeySummary;
  pending: boolean;
  onRename: (friendlyName: string) => void;
  onRevoke: () => void;
}) {
  const [name, setName] = useState(passkey.friendlyName ?? "");

  const trimmed = name.trim();
  const canRename =
    trimmed.length > 0 && trimmed !== (passkey.friendlyName ?? "").trim();

  return (
    <Item
      className="flex-col items-stretch gap-4"
      role="listitem"
      variant="outline"
    >
      <PasskeyHeadline passkey={passkey} />

      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();

          if (!canRename) {
            return;
          }

          onRename(trimmed);
        }}
      >
        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor={`passkey-name-${passkey.id}`}>Name</FieldLabel>
            <Input
              id={`passkey-name-${passkey.id}`}
              maxLength={120}
              name="friendlyName"
              onChange={(event) => {
                setName(event.target.value);
              }}
              type="text"
              value={name}
            />
          </Field>
        </FieldGroup>

        {isLastPasskey ? (
          <Alert variant="destructive">
            <AlertTitle>This is your only passkey</AlertTitle>
            <AlertDescription>{LAST_PASSKEY_LOCKOUT_COPY}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pending || !canRename}
            type="submit"
            variant="outline"
          >
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
