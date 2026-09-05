import { RecordEditPage } from "@/ui/home-records/edit-page";
import type { RawRecordQuery } from "@/lib/home-records/query";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawRecordQuery>;
}) {
  return <RecordEditPage kind="inventory" query={await searchParams} />;
}
