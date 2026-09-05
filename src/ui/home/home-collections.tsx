import Link from "next/link";
import {
  Boxes,
  CalendarClock,
  ContactRound,
  Files,
  Lightbulb,
} from "lucide-react";
import { PageSection } from "@/ui/layout/page-section";

const collections = [
  {
    href: "/home/inventory",
    title: "Inventory",
    detail: "Belongings, warranties and care",
    icon: Boxes,
  },
  {
    href: "/home/commitments",
    title: "Commitments",
    detail: "Renewals and cancellation dates",
    icon: CalendarClock,
  },
  {
    href: "/home/decisions",
    title: "Decisions",
    detail: "Compare ideas and choose together",
    icon: Lightbulb,
  },
  {
    href: "/home/documents",
    title: "Documents",
    detail: "Receipts, manuals and contracts",
    icon: Files,
  },
  {
    href: "/home/contacts",
    title: "Contacts",
    detail: "Useful people and services",
    icon: ContactRound,
  },
] as const;

export function HomeCollections() {
  return (
    <PageSection title="Household records" titleId="household-records-title">
      <nav aria-label="Household records" className="@container">
        <ul className="grid list-none gap-3 @min-[22rem]:grid-cols-2 @min-[48rem]:grid-cols-3">
          {collections.map(({ href, title, detail, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex h-full min-h-28 flex-col gap-2 rounded-2xl border bg-card p-4 no-underline transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon
                    aria-hidden="true"
                    className="size-5 shrink-0 text-primary"
                  />
                  <strong className="font-heading text-base">{title}</strong>
                </span>
                <span className="text-sm text-muted-foreground">{detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </PageSection>
  );
}
