"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const SETUP_PATH = "/home/setup";

/**
 * Long enough to read the confirmation, short enough that a stale `?saved=`
 * cannot be reloaded or bookmarked back into view.
 */
const CLEAR_DELAY_MS = 6000;

type SavedNoticeProps = {
  message: string | null;
};

export function SavedNotice({ message }: SavedNoticeProps) {
  const router = useRouter();
  const clear = useCallback(() => {
    router.replace(SETUP_PATH, { scroll: false });
  }, [router]);

  useEffect(() => {
    if (message === null) {
      return;
    }
    const timer = window.setTimeout(clear, CLEAR_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [clear, message]);

  return (
    // A section rather than a div: FormSection's `first-of-type` padding rule
    // counts sibling divs. Mounted on every render: a live region inserted in
    // the same commit as its content is announced unreliably.
    <section aria-live="polite">
      {message === null ? null : (
        <Alert className="mb-6" role="presentation">
          {/* The wrapper above is the live region; Alert's own `role="alert"`
              would be both assertive and the unreliable same-commit kind. The
              important flag beats Alert forcing `text-current` on its svg. */}
          <Check aria-hidden="true" className="text-primary!" />
          <AlertTitle>{message}</AlertTitle>
          <Button
            className="justify-self-start"
            onClick={clear}
            size="sm"
            type="button"
            variant="ghost"
          >
            Dismiss
          </Button>
        </Alert>
      )}
    </section>
  );
}
