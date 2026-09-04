import Link from "next/link";
import { ArrowUpRight, MapPin, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { HouseholdProject, ProjectKind } from "@/domain/projects/types";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";

export function ProjectList({
  kind,
  projects,
  archived,
  page,
  hasMore,
}: {
  kind: ProjectKind;
  projects: HouseholdProject[];
  archived: boolean;
  page: number;
  hasMore: boolean;
}) {
  const path = kind === "trip" ? "/plan/trips" : "/plan/projects";
  const title = kind === "trip" ? "Trips" : "Projects";
  const suffix = archived ? "&archived=1" : "";
  return (
    <AppPage labelledBy="projects-title">
      <PageHeader
        titleId="projects-title"
        title={title}
        eyebrow={
          kind === "trip"
            ? "Places to go, together"
            : "Make room for what’s next"
        }
        trailing={
          <Link className={buttonVariants()} href={`${path}/new`}>
            <Plus />
            {kind === "trip" ? "Plan a trip" : "New project"}
          </Link>
        }
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {archived
            ? "Archived plans and their history."
            : kind === "trip"
              ? "Bookings, packing, and shared costs in one place."
              : "From small improvements to your next big idea."}
        </p>
        <Link
          className="shrink-0 text-sm underline underline-offset-4"
          href={`${path}${archived ? "" : "?archived=1"}`}
        >
          {archived ? "Current plans" : "Archive"}
        </Link>
      </div>
      <ProjectCards projects={projects} kind={kind} archived={archived} />
      <nav aria-label="Plan pages" className="flex justify-between gap-3">
        {page > 0 && (
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={`${path}?page=${page - 1}${suffix}`}
          >
            Previous
          </Link>
        )}
        {hasMore && (
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={`${path}?page=${page + 1}${suffix}`}
          >
            More plans
          </Link>
        )}
      </nav>
    </AppPage>
  );
}

function ProjectCards({
  projects,
  kind,
  archived,
}: {
  projects: HouseholdProject[];
  kind: ProjectKind;
  archived: boolean;
}) {
  return (
    <>
      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-12 text-center">
          <h2 className="text-lg font-semibold">
            {archived
              ? "Nothing archived"
              : kind === "trip"
                ? "Where shall we go?"
                : "What would you like to do?"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {archived
              ? "Archived plans will stay available here."
              : "Start with a name. Add the details as you decide together."}
          </p>
        </div>
      ) : (
        <ul className="grid list-none gap-3 @xl:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/plan/projects/${project.id}`}
                className="group flex h-full min-h-36 flex-col gap-3 rounded-2xl border bg-card p-5 no-underline transition-colors hover:bg-muted/60 active:bg-muted"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {project.title}
                  </h2>
                  <ArrowUpRight className="size-5 shrink-0 text-muted-foreground" />
                </div>
                {project.destination && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="size-4" />
                    {project.destination}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="capitalize">
                    {project.status === "active"
                      ? "In progress"
                      : project.status}
                  </span>
                  <span className="text-muted-foreground">
                    {project.starts_on ?? "Dates to decide"}
                    {project.ends_on ? ` → ${project.ends_on}` : ""}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
