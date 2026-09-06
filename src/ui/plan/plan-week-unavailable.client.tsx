"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function PlanWeekUnavailable() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
      <p role="status" className="text-sm text-muted-foreground">
        Plans and routines couldn’t load. Meals are still here.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {pending ? "Loading plans…" : "Retry plans & routines"}
      </Button>
    </div>
  );
}
