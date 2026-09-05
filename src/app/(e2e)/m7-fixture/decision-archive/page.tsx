import { notFound } from "next/navigation";
import { RelatedSection } from "@/ui/home-records/related-section";
export default function Page() {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  return (
    <main>
      {[false, true].map((archived) => (
        <section
          key={String(archived)}
          aria-label={archived ? "Archived decision" : "Active decision"}
        >
          <RelatedSection
            kind="options"
            rows={[
              {
                id: "34000000-0000-4000-8000-000000000010",
                title: "Train",
                updated_at: "2026-09-05T12:00:00Z",
                chosen: false,
              },
            ]}
            parent={{
              column: "decision_id",
              id: "34000000-0000-4000-8000-000000000011",
            }}
            parentArchived={archived}
            returnTo="/m7-fixture/decision-archive"
            options={{}}
            query={{}}
          />
        </section>
      ))}
    </main>
  );
}
