import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ROUTINE_STARTERS } from "@/lib/routines/starters";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";

export default function RoutineStartersPage() {
  return (
    <AppPage labelledBy="starters-title">
      <div className="grid w-full max-w-3xl gap-6">
        <PageHeader
          title="Make it your home"
          titleId="starters-title"
          trailing={
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/home"
            >
              Back to Home
            </Link>
          }
        />
        <p className="max-w-prose text-pretty text-muted-foreground">
          Start with the routines that fit your life. Pick one, choose who and
          when, then save. Nothing is added until you decide.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2" role="list">
          {ROUTINE_STARTERS.map((starter) => (
            <li key={starter.id}>
              <Link
                className="flex h-full items-start justify-between gap-4 rounded-2xl border p-4 no-underline transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                href={`/home/routines/new?starter=${starter.id}`}
              >
                <div className="grid gap-2">
                  <h2 className="font-heading text-lg font-semibold">
                    {starter.title}
                  </h2>
                  <p className="text-base text-pretty text-muted-foreground sm:text-sm">
                    {starter.description}
                  </p>
                </div>
                <ArrowRight aria-hidden className="size-5 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
        <Link className="w-fit" href="/home/routines/new">
          Start with a blank routine
        </Link>
      </div>
    </AppPage>
  );
}
