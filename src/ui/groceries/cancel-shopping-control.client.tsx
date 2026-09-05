"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formErrorMessage } from "@/lib/forms/action-state";

export function CancelShoppingControl({
  action,
  sessionId,
}: {
  action: (data: FormData) => Promise<"cancelled" | "completed">;
  sessionId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="grid gap-2 border-t pt-4">
      {completed ? (
        <div className="grid gap-2" role="status">
          <p>This shopping session was already completed.</p>
          <Link
            className="min-h-11 py-2 underline"
            href={`/groceries/shopping/${sessionId}`}
          >
            Review the purchase
          </Link>
        </div>
      ) : (
        <>
          <Button
            className="min-h-11"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (pending) return;
              startTransition(async () => {
                setError("");
                const data = new FormData();
                data.set("sessionId", sessionId);
                try {
                  if ((await action(data)) === "completed") {
                    setCompleted(true);
                    return;
                  }
                  router.push("/groceries");
                  router.refresh();
                } catch (cause) {
                  setError(formErrorMessage(cause));
                }
              });
            }}
          >
            {pending ? "Ending session…" : "End session without purchasing"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Everything in your cart returns to the shopping list.
          </p>
        </>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
