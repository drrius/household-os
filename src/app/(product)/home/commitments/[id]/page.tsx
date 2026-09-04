import { RecordDetailPage } from "@/ui/home-records/detail-page";
import type { RecordQuery } from "@/lib/home-records/read";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RecordQuery>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <RecordDetailPage kind="commitments" id={id} query={query} />;
}
