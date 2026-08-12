"use client";

import { Button } from "@/components/ui/button";
import { AppPage } from "@/ui/layout/app-page";
import { EmptyState } from "@/ui/layout/empty-state";
import { PageHeader } from "@/ui/layout/page-header";

export default function ProductError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <AppPage labelledBy="error-title">
      <PageHeader title="Something went wrong" titleId="error-title" />
      <EmptyState
        title="This view could not load"
        action={
          <Button type="button" onClick={retry}>
            Try again
          </Button>
        }
      >
        <p>Your data is safe. Retry to reload this screen.</p>
      </EmptyState>
    </AppPage>
  );
}
