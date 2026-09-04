import { RecordEditPage } from "@/ui/home-records/edit-page";
import type { RecordQuery } from "@/lib/home-records/read";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RecordQuery>;
}) {
  return <RecordEditPage kind="commitments" query={await searchParams} />;
}
