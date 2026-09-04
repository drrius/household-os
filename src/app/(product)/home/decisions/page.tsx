import { RecordListPage } from "@/ui/home-records/list-page";
import type { RecordQuery } from "@/lib/home-records/read";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RecordQuery>;
}) {
  return <RecordListPage kind="decisions" query={await searchParams} />;
}
