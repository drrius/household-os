"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formErrorMessage } from "@/lib/forms/action-state";

export function QuickAdd({
  action,
}: {
  action: (data: FormData) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending || name.trim() === "") return;
          const submittedName = name;
          const data = new FormData(event.currentTarget);
          setMessage("");
          startTransition(async () => {
            try {
              await action(data);
              setName((current) => (current === submittedName ? "" : current));
              setError(false);
              setMessage(`${submittedName.trim()} added`);
            } catch (failure) {
              setError(true);
              setMessage(formErrorMessage(failure));
            }
            inputRef.current?.focus();
          });
        }}
      >
        <Input
          aria-label="Add grocery item"
          autoComplete="off"
          readOnly={pending}
          aria-busy={pending}
          className="min-h-12 min-w-0 flex-1 text-base"
          maxLength={120}
          name="name"
          onChange={(event) => setName(event.target.value)}
          placeholder="What do we need?"
          ref={inputRef}
          required
          value={name}
        />
        <Button
          aria-label="Add item"
          className="min-h-12 min-w-12"
          disabled={pending || !name.trim()}
          size="icon-lg"
          type="submit"
        >
          <PlusIcon aria-hidden="true" className="size-5" />
        </Button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p
          aria-live="polite"
          className={error ? "text-destructive" : undefined}
        >
          {pending
            ? "Adding…"
            : message || "Add a few things, one after another."}
        </p>
        <Link
          className="inline-flex min-h-11 items-center underline underline-offset-4"
          href="/groceries/new"
        >
          Add with details
        </Link>
      </div>
    </div>
  );
}
