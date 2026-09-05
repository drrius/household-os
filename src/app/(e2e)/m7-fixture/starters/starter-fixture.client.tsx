"use client";
import { useRef } from "react";
import { StarterChecklists } from "@/ui/projects/starter-checklists.client";

export function StarterFixture({ ids }: { ids: Record<string, string> }) {
  const prior = useRef<string | null>(null);
  return (
    <StarterChecklists
      projectId="22000200-0000-4000-8000-000000000001"
      kind="trip"
      taskIds={ids}
      action={async (_previous, form) => {
        const identity = JSON.stringify(Array.from(form.entries()));
        await new Promise<void>((resolve) =>
          window.addEventListener("starter-response", () => resolve(), {
            once: true,
          }),
        );
        if (prior.current === null) {
          prior.current = identity;
          return { error: "Connection interrupted. Retry the same selection." };
        }
        if (identity !== prior.current)
          return { error: "The retry changed its request identities." };
        const count = form.getAll("item").length;
        return { added: Math.max(0, count - 1), skipped: 1 };
      }}
    />
  );
}
