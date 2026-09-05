import { loadProjects } from "@/lib/projects/queries";
import { ProjectList } from "@/ui/projects/project-list";

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; page?: string }>;
}) {
  const query = await searchParams;
  const archived = query.archived === "1";
  const page = Math.max(
    0,
    Math.min(10000, Number.parseInt(query.page ?? "0", 10) || 0),
  );
  const data = await loadProjects("trip", archived, page);
  return <ProjectList kind="trip" {...data} archived={archived} page={page} />;
}
