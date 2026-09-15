import { Button, ScrollView, Text, View } from "react-native";
import { usePlan } from "../../src/plan/usePlan";
import { useSession } from "../../src/session/SessionProvider";
import { tokens } from "../../src/theme/tokens";

export default function PlanScreen() {
  const session = useSession();
  const state = usePlan(session);

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} testID="plan-loading">
        <Text>Loading plan…</Text>
      </View>
    );
  }
  if (state.status === "signed-out") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Sign in to see the plan.</Text>
      </View>
    );
  }
  if (state.status === "error") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} testID="plan-error">
        <Text>Couldn&apos;t load plan: {state.message}</Text>
        <Button title="Retry" onPress={state.retry} />
      </View>
    );
  }

  const m = state.model;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.color.background }}
      contentContainerStyle={{ padding: tokens.space.md }}
      testID="plan-screen"
    >
      <Text style={{ fontSize: tokens.type.title, fontWeight: "700" }}>
        Plan · {m.rangeLabel}
      </Text>
      {m.days.map((day) => (
        <View key={day.date} style={{ marginTop: tokens.space.md }}>
          <Text style={{ fontWeight: "600" }}>
            {day.weekdayLabel} {day.date}
            {day.isToday ? " · today" : ""}
          </Text>
          {day.routines.map((r) => (
            <Text key={r.occurrenceId}>• {r.title}</Text>
          ))}
          {day.slots.map((s) => (
            <Text key={s.slot}>
              {s.slot}: {s.entry ? s.entry.title : "—"}
            </Text>
          ))}
        </View>
      ))}
      <Text style={{ fontWeight: "600", marginTop: tokens.space.md }}>
        Library ({m.library.length})
      </Text>
      {m.library.map((l) => (
        <Text key={l.id}>• {l.title}</Text>
      ))}
    </ScrollView>
  );
}
