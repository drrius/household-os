"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formErrorMessage } from "@/lib/forms/action-state";

export function GroceryMutationButton({
  action,
  label,
  successMessage,
  fields = {},
  disabled = false,
  onSuccess,
  once = false,
}: {
  action: (data: FormData) => Promise<void>;
  label: string;
  successMessage: string;
  fields?: Record<string, string>;
  disabled?: boolean;
  onSuccess?: () => void;
  once?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  return (
    <div className="grid gap-1">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const data = new FormData(event.currentTarget);
          startTransition(async () => {
            try {
              await action(data);
              setFailed(false);
              setMessage(successMessage);
              onSuccess?.();
            } catch (error) {
              setFailed(true);
              setMessage(formErrorMessage(error));
              router.refresh();
            }
          });
        }}
      >
        {Object.entries(fields).map(([name, value]) => (
          <input key={name} name={name} type="hidden" value={value} />
        ))}
        <Button
          className="min-h-11"
          disabled={
            pending ||
            disabled ||
            (once && message === successMessage && !failed)
          }
          type="submit"
          variant="outline"
        >
          {pending ? "Saving…" : label}
        </Button>
      </form>
      {message ? (
        <p
          aria-live="polite"
          className={
            failed
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
