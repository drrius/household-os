import { notFound } from "next/navigation";
import { buildHomeViewModel } from "@/lib/read-models/home";
import { HomeScreen } from "@/ui/home/home-screen";
import { AppShell } from "@/ui/shell/app-shell";

export default function Page() {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const model = buildHomeViewModel({
    viewerId: "member-a",
    households: [{ id: "home", name: "Fixture household" }],
    members: [
      {
        user_id: "member-a",
        display_name: "Alex",
        joined_at: "2026-09-01T10:00:00Z",
      },
      {
        user_id: "member-b",
        display_name: "Robin",
        joined_at: "2026-09-01T10:00:00Z",
      },
    ],
    pets: [],
    areas: [],
    routines: [],
    activityEvents: [
      { record_kind: "asset", label: "Washing machine", operation: "added" },
      {
        record_kind: "commitment",
        label: "Internet subscription",
        operation: "updated",
      },
      { record_kind: "document", label: "Old manual", operation: "archived" },
      {
        record_kind: "contact",
        label: "Repair service",
        operation: "restored",
      },
    ].map((payload, index) => ({
      id: `event-${index}`,
      actor_member_id: index % 2 ? "member-a" : "member-b",
      kind: "household_record_changed" as const,
      entity_type: "household_record",
      entity_id: `record-${index}`,
      payload,
      created_at: "2026-09-05T10:00:00Z",
    })),
  });
  return (
    <AppShell>
      <HomeScreen model={model} />
    </AppShell>
  );
}
