"use client";

import { AppPage } from "@/ui/primitives/app-page";
import { EmptyState } from "@/ui/primitives/empty-state";
import { PageHeader } from "@/ui/primitives/page-header";

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
          <button
            type="button"
            className="button button--primary"
            onClick={retry}
          >
            Try again
          </button>
        }
      >
        <p>Your data is safe. Retry to reload this screen.</p>
      </EmptyState>
    </AppPage>
  );
}
