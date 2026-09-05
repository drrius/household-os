"use client";

import { CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formErrorMessage } from "@/lib/forms/action-state";
import { cn } from "@/lib/utils";

export function CartControl({
  action,
  item,
}: {
  action: (data: FormData) => Promise<void>;
  item: {
    id: string;
    name: string;
    claimedByName: string | null;
    claimedByMe: boolean;
  };
}) {
  const router = useRouter();
  const [checked, setChecked] = useOptimistic(item.claimedByName !== null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const claimedByOther = item.claimedByName !== null && !item.claimedByMe;
  return (
    <div className="contents">
      <Button
        aria-checked={checked}
        aria-label={
          item.claimedByMe
            ? `Remove ${item.name} from your cart`
            : claimedByOther
              ? `${item.name} is in ${item.claimedByName}'s cart`
              : `Add ${item.name} to your cart`
        }
        className="size-12"
        disabled={claimedByOther || pending}
        onClick={() => {
          const data = new FormData();
          data.set("itemId", item.id);
          data.set("intent", item.claimedByMe ? "release" : "claim");
          setError("");
          startTransition(async () => {
            setChecked(!checked);
            try {
              await action(data);
            } catch (failure) {
              setError(formErrorMessage(failure));
              router.refresh();
            }
          });
        }}
        role="checkbox"
        size="icon-lg"
        type="button"
        variant="ghost"
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-md border border-input motion-safe:transition-transform motion-safe:duration-150",
            checked &&
              "scale-105 border-success bg-success text-success-foreground",
          )}
        >
          {checked ? <CheckIcon className="size-4" strokeWidth={3} /> : null}
        </span>
      </Button>
      {error ? (
        <p
          className="order-1 col-span-full px-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
