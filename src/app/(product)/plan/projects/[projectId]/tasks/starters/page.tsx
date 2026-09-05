import { notFound } from "next/navigation";
import Link from "next/link";
import { startersFor } from "@/domain/projects/starters";
import { loadProject } from "@/lib/projects/queries";
import { FormPage } from "@/ui/forms/form-page";
import { StarterChecklists } from "@/ui/projects/starter-checklists.client";

export default async function StarterPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await loadProject(projectId);
  if (!project) notFound();
  return (
    <FormPage
      title="A useful starting point"
      description={project.title}
      backHref={`/plan/projects/${projectId}#tasks`}
    >
      {project.archived_at ? (
        <p>
          Restore this plan before adding tasks.{" "}
          <Link href={`/plan/projects/${projectId}`}>Open the plan</Link>
        </p>
      ) : (
        <StarterChecklists
          key={projectId}
          projectId={projectId}
          kind={project.kind}
          taskIds={Object.fromEntries(
            startersFor(project.kind).flatMap((starter) =>
              starter.tasks.map(([key]) => [
                `${starter.key}:${key}`,
                crypto.randomUUID(),
              ]),
            ),
          )}
        />
      )}
    </FormPage>
  );
}
