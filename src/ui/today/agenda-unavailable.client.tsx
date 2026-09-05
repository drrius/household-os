"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageSection } from "@/ui/layout/page-section";

export function AgendaUnavailable() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <PageSection title="Our plans & deadlines" titleId="today-agenda-title">
      <p role="status" className="text-sm text-muted-foreground">
        Plans and deadlines couldn’t load. Your other daily activities are still
        available.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {pending ? "Loading plans…" : "Retry plans & deadlines"}
      </Button>
    </PageSection>
  );
}
