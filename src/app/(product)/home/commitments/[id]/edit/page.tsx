import { RecordEditPage } from "@/ui/home-records/edit-page";
import type { RawRecordQuery } from "@/lib/home-records/query";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawRecordQuery>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <RecordEditPage kind="commitments" id={id} query={query} />;
}
