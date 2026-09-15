import { useState } from "react";
import { Button, ScrollView, Text, TextInput, View } from "react-native";
import {
  placeFreeformMeal,
  removeMealEntry,
} from "../../src/mutations/plan-home";
import { usePlan } from "../../src/plan/usePlan";
import { useSession } from "../../src/session/SessionProvider";
import { tokens } from "../../src/theme/tokens";
import { zurichCivilDate } from "../../src/today/useToday";

export default function PlanScreen() {
  const session = useSession();
  const { state, refresh } = usePlan(session);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setPending(true);
    setFailure(null);
    try {
      await fn();
      refresh();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Failed");
    } finally {
      setPending(false);
    }
  };

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
  const today = zurichCivilDate(0);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.color.background }}
      contentContainerStyle={{ padding: tokens.space.md }}
      testID="plan-screen"
    >
      <Text style={{ fontSize: tokens.type.title, fontWeight: "700" }}>
        Plan · {m.rangeLabel}
      </Text>

      <View style={{ flexDirection: "row", gap: tokens.space.sm, marginTop: tokens.space.md }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Tonight's dinner"
          testID="meal-title-input"
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: tokens.color.border,
            borderRadius: tokens.radius.sm,
            padding: tokens.space.sm,
          }}
        />
        <Button
          title="Add dinner"
          disabled={pending || !title.trim()}
          onPress={() =>
            void run(async () => {
              await placeFreeformMeal(session, today, "dinner", title);
              setTitle("");
            })
          }
        />
      </View>
      {failure ? <Text style={{ color: tokens.color.danger }}>{failure}</Text> : null}

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
            <View key={s.slot}>
              <Text>
                {s.slot}: {s.entry ? s.entry.title : "—"}
              </Text>
              {s.entry ? (
                <Button
                  title="Remove"
                  disabled={pending}
                  onPress={() => void run(() => removeMealEntry(session, s.entry?.id ?? ""))}
                />
              ) : null}
            </View>
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
