"use client";

import { useRouter } from "next/navigation";
import { GroceryMutationButton } from "./mutation-button.client";

export function CancelShoppingControl({
  action,
  sessionId,
}: {
  action: (data: FormData) => Promise<void>;
  sessionId: string;
}) {
  const router = useRouter();
  return (
    <div className="grid gap-2 border-t pt-4">
      <GroceryMutationButton
        action={action}
        fields={{ sessionId }}
        label="End session without purchasing"
        onSuccess={() => router.push("/groceries")}
        successMessage="Your items are back on the list"
      />
      <p className="text-sm text-muted-foreground">
        Everything in your cart returns to the shopping list.
      </p>
    </div>
  );
}
