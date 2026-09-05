import { RecordDetailPage } from "@/ui/home-records/detail-page";
import type { RawRecordQuery } from "@/lib/home-records/query";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawRecordQuery>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <RecordDetailPage kind="documents" id={id} query={query} />;
}
