import { Skeleton } from "@/components/ui/skeleton";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";

export default function ProductLoading() {
  return (
    <AppPage labelledBy="loading-title">
      <PageHeader title="Loading" titleId="loading-title" />
      <div className="grid gap-4" aria-busy="true" aria-live="polite">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-3/4" />
      </div>
    </AppPage>
  );
}
