"use client";

import { useRouter } from "next/navigation";
import { GroceryMutationButton } from "./mutation-button.client";

export function RemoveGroceryControl({
  action,
  itemId,
}: {
  action: (data: FormData) => Promise<void>;
  itemId: string;
}) {
  const router = useRouter();
  return (
    <GroceryMutationButton
      action={action}
      fields={{ itemId }}
      label="Remove from list"
      onSuccess={() => router.push("/groceries")}
      successMessage="Item removed"
    />
  );
}
