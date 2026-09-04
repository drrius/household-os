import { RecordEditPage } from "@/ui/home-records/edit-page";
import type { RecordQuery } from "@/lib/home-records/read";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RecordQuery>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <RecordEditPage kind="commitments" id={id} query={query} />;
}
