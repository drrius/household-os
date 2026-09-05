import { RecordListPage } from "@/ui/home-records/list-page";
import type { RawRecordQuery } from "@/lib/home-records/query";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawRecordQuery>;
}) {
  return <RecordListPage kind="contacts" query={await searchParams} />;
}
