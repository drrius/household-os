"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { describeSignInError } from "@/app/sign-in/sign-in-error-copy";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

function debugSignInFailure(error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.debug("Passkey sign-in failed", error);
  }
}

// The live region stays mounted so the waiting sentence is announced, and
// collapses out of the form grid whenever it holds nothing.
function SignInProgress({
  pending,
  onCancel,
}: {
  pending: boolean;
  onCancel: () => void;
}) {
  return (
    <>
      {pending ? (
        <Button
          className="h-11 w-full text-base md:h-11"
          onClick={onCancel}
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
      ) : null}

      <p
        aria-live="polite"
        className="text-sm text-muted-foreground empty:hidden"
        role="status"
      >
        {pending
          ? "Waiting for your passkey. Finish the prompt from your browser, phone, or security key."
          : null}
      </p>
    </>
  );
}

export function SignInForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const attemptRef = useRef<AbortController | null>(null);

  async function handleSignIn() {
    if (pending) {
      return;
    }

    const attempt = new AbortController();
    attemptRef.current = attempt;
    setPending(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPasskey({
        options: { signal: attempt.signal },
      });

      // A cancelled ceremony is a decision, not a failure worth alerting about.
      if (attempt.signal.aborted) {
        return;
      }

      if (error) {
        debugSignInFailure(error);
        setErrorMessage(describeSignInError(error));
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      debugSignInFailure(error);

      if (!attempt.signal.aborted) {
        setErrorMessage(describeSignInError(error));
      }
    } finally {
      attemptRef.current = null;
      setPending(false);
    }
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSignIn();
      }}
    >
      <Button
        aria-disabled={pending}
        className="h-11 w-full text-base md:h-11 aria-disabled:cursor-progress aria-disabled:bg-primary/90 aria-disabled:opacity-100"
        type="submit"
      >
        {pending ? "Waiting for passkey…" : "Sign in with passkey"}
      </Button>

      <SignInProgress
        pending={pending}
        onCancel={() => {
          attemptRef.current?.abort();
        }}
      />

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Sign-in failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
