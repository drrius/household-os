"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function SignInForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSignIn() {
    setPending(true);
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPasskey();

    if (error) {
      setErrorMessage(error.message);
      setPending(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleSignIn();
      }}
    >
      <button type="submit" disabled={pending}>
        Sign in with passkey
      </button>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
    </form>
  );
}
