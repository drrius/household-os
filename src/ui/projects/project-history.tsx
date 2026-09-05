import Link from "next/link";
import {
  projectActivityChanges,
  projectActivityTitle,
} from "@/domain/projects/activity";
import type { ProjectMember } from "@/domain/projects/types";
import type { ProjectActivityEntry } from "@/lib/projects/activity";
import { formatZurichTimestamp } from "@/lib/ui/zurich-date";

export function ProjectHistory({
  entries,
  members,
  page,
  hasMore,
  href,
}: {
  entries: readonly ProjectActivityEntry[];
  members: readonly ProjectMember[];
  page: number;
  hasMore: boolean;
  href: (page: number) => string;
}) {
  return (
    <section
      id="history"
      className="grid gap-3 border-t pt-5"
      aria-labelledby="project-history-title"
    >
      <h2 id="project-history-title" className="text-xl font-semibold">
        Change history
      </h2>
      <p className="text-sm text-muted-foreground">
        Expand a change to see the previous values.
      </p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No changes on this page.
        </p>
      ) : (
        <ol className="grid list-none gap-3">
          {entries.map((entry) => (
            <HistoryEntry key={entry.id} entry={entry} members={members} />
          ))}
        </ol>
      )}
      <nav className="flex gap-4 text-sm" aria-label="Change history pages">
        {page > 0 && (
          <Link className="py-3" href={href(page - 1)}>
            Newer changes
          </Link>
        )}
        {hasMore && (
          <Link className="py-3" href={href(page + 1)}>
            Older changes
          </Link>
        )}
      </nav>
    </section>
  );
}

function HistoryEntry({
  entry,
  members,
}: {
  entry: ProjectActivityEntry;
  members: readonly ProjectMember[];
}) {
  return (
    <li>
      <details className="rounded-xl border px-4">
        <summary className="cursor-pointer py-3 text-sm">
          {members.find((member) => member.user_id === entry.actor_member_id)
            ?.display_name ?? "A household member"}{" "}
          {projectActivityTitle(entry.payload)}
          <span className="mt-1 block text-xs text-muted-foreground">
            {formatZurichTimestamp(entry.created_at)}
          </span>
        </summary>
        <dl className="grid gap-4 pb-4 text-sm">
          {projectActivityChanges(entry.payload, members).map((change) => (
            <div key={change.label} className="min-w-0">
              <dt className="font-medium">{change.label}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words">
                <span className="text-muted-foreground">Before: </span>
                {change.before}
              </dd>
              <dd className="mt-1 whitespace-pre-wrap break-words">
                <span className="text-muted-foreground">After: </span>
                {change.after}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </li>
  );
}
