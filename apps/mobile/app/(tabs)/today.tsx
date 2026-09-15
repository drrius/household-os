import { Button, ScrollView, Text, View } from "react-native";
import { useSession } from "../../src/session/SessionProvider";
import { tokens } from "../../src/theme/tokens";
import { useToday } from "../../src/today/useToday";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: tokens.space.lg }}>
      <Text
        style={{
          fontSize: tokens.type.body,
          fontWeight: "600",
          color: tokens.color.text,
          marginBottom: tokens.space.sm,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function TodayScreen() {
  const session = useSession();
  const state = useToday(session);

  if (state.status === "loading") {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        testID="today-loading"
      >
        <Text>Loading today…</Text>
      </View>
    );
  }
  if (state.status === "signed-out") {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        testID="today-signed-out"
      >
        <Text>Sign in to see today.</Text>
      </View>
    );
  }
  if (state.status === "error") {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        testID="today-error"
      >
        <Text>Couldn&apos;t load today: {state.message}</Text>
        <Button title="Retry" onPress={state.retry} />
      </View>
    );
  }

  const m = state.model;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.color.background }}
      contentContainerStyle={{ padding: tokens.space.md }}
      testID="today-screen"
    >
      <Text style={{ fontSize: tokens.type.title, fontWeight: "700" }}>
        Hi {m.greetingName}
      </Text>
      <Text style={{ color: tokens.color.muted, marginBottom: tokens.space.md }}>
        {m.civilDate} · {m.completedCount}/{m.totalCount} done
      </Text>

      {m.balancePill && m.balancePill.kind !== "settled" ? (
        <Text testID="balance-pill">
          {m.balancePill.kind === "partner_owes_you" ? "Sam owes you " : "You owe Sam "}
          {m.balancePill.amountLabel}
        </Text>
      ) : null}

      <Section title="Overdue">
        {m.overdue.length === 0 ? (
          <Text>Nothing overdue.</Text>
        ) : (
          m.overdue.map((r) => <Text key={r.occurrenceId}>• {r.title} ({r.meta})</Text>)
        )}
      </Section>

      <Section title="Today">
        {m.routinesToday.length === 0 ? (
          <Text>Nothing due today.</Text>
        ) : (
          m.routinesToday.map((r) => <Text key={r.occurrenceId}>• {r.title}</Text>)
        )}
      </Section>

      <Section title="Meals">
        {m.meals.length === 0 ? (
          <Text>No meals planned.</Text>
        ) : (
          m.meals.map((meal) =>
            meal.kind === "meal" ? (
              <Text key={meal.entryId}>
                • {meal.title} ({meal.day}
                {meal.slot ? `, ${meal.slot}` : ""})
              </Text>
            ) : null
          )
        )}
      </Section>

      <Section title="Shopping">
        {m.shopping.kind === "empty" ? (
          <Text>List is clear.</Text>
        ) : m.shopping.kind === "list" ? (
          <Text>{m.shopping.itemCount} items on the list.</Text>
        ) : (
          <Text>
            {m.shopping.itemCount} items · {m.shopping.shopperNames.join(", ")} shopping now.
          </Text>
        )}
      </Section>

      <Section title="Money drafts">
        {m.pendingDrafts.length === 0 ? (
          <Text>No drafts need confirmation.</Text>
        ) : (
          m.pendingDrafts.map((d) => (
            <Text key={d.draftId}>
              • {d.title}
              {d.amountLabel ? ` — ${d.amountLabel}` : ""}
            </Text>
          ))
        )}
      </Section>
    </ScrollView>
  );
}
