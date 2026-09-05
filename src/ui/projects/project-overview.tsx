import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { HouseholdProject } from "@/domain/projects/types";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { archiveProjectAction } from "@/app/(product)/plan/projects/actions";
import { RecordAction } from "@/ui/projects/record-action.client";

export function ProjectOverview({ project }: { project: HouseholdProject }) {
  const base = project.kind === "trip" ? "/plan/trips" : "/plan/projects";
  return (
    <header className="grid gap-4">
      <Link
        href={base}
        className="flex w-fit items-center gap-2 py-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
        {project.kind === "trip" ? "Trips" : "Projects"}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-2 text-sm capitalize text-muted-foreground">
            {project.archived_at
              ? "Archived"
              : project.status === "active"
                ? "In progress"
                : project.status}
          </p>
          <h1
            id="project-title"
            className="text-3xl font-semibold tracking-tight"
          >
            {project.title}
          </h1>
        </div>
        {!project.archived_at && (
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={`/plan/projects/${project.id}/edit`}
          >
            Edit details
          </Link>
        )}
      </div>
      {project.destination && (
        <p className="flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" />
          {project.destination}
        </p>
      )}
      {(project.starts_on || project.ends_on) && (
        <p className="text-sm text-muted-foreground">
          {project.starts_on ?? "Start to decide"}
          {project.ends_on ? ` → ${project.ends_on}` : ""}
        </p>
      )}
      {project.description && (
        <p className="max-w-3xl whitespace-pre-wrap leading-relaxed text-muted-foreground">
          {project.description}
        </p>
      )}
      {project.budget_cents !== null && (
        <p className="text-sm">
          Budget <strong>{formatCentimesAsFrancs(project.budget_cents)}</strong>
        </p>
      )}
      {project.archived_at && (
        <div className="rounded-xl border p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            This plan is archived. Its documents and financial history remain
            available.
          </p>
          <RecordAction
            action={archiveProjectAction}
            fields={{
              id: project.id,
              updatedAt: project.updated_at,
              archived: "false",
            }}
            label="Restore plan"
          />
        </div>
      )}
    </header>
  );
}

export function ProjectArchive({ project }: { project: HouseholdProject }) {
  if (project.archived_at) return null;
  return (
    <details className="border-t pt-4">
      <summary className="cursor-pointer py-2 text-sm text-muted-foreground">
        Finished with this plan?
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <p className="text-sm text-muted-foreground">
          Archive it to clear your list. You can restore it later.
        </p>
        <RecordAction
          action={archiveProjectAction}
          fields={{
            id: project.id,
            updatedAt: project.updated_at,
            archived: "true",
          }}
          label="Archive plan"
        />
      </div>
    </details>
  );
}
