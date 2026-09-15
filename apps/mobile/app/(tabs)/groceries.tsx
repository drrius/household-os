import { Button, ScrollView, Text, View } from "react-native";
import { useGroceries } from "../../src/groceries/useGroceries";
import { useSession } from "../../src/session/SessionProvider";
import { tokens } from "../../src/theme/tokens";

export default function GroceriesScreen() {
  const session = useSession();
  const state = useGroceries(session);

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} testID="groceries-loading">
        <Text>Loading groceries…</Text>
      </View>
    );
  }
  if (state.status === "signed-out") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Sign in to see groceries.</Text>
      </View>
    );
  }
  if (state.status === "error") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} testID="groceries-error">
        <Text>Couldn&apos;t load groceries: {state.message}</Text>
        <Button title="Retry" onPress={state.retry} />
      </View>
    );
  }

  const m = state.model;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.color.background }}
      contentContainerStyle={{ padding: tokens.space.md }}
      testID="groceries-screen"
    >
      <Text style={{ fontSize: tokens.type.title, fontWeight: "700" }}>
        Groceries ({m.activeItemCount})
      </Text>
      {m.liveSession ? (
        <Text style={{ marginVertical: tokens.space.sm }}>
          {m.liveSession.memberName} is shopping · {m.liveSession.claimedCount}/
          {m.liveSession.totalCount} claimed
        </Text>
      ) : null}
      {m.categories.map((c) => (
        <View key={c.id} style={{ marginTop: tokens.space.md }}>
          <Text style={{ fontWeight: "600" }}>{c.name}</Text>
          {c.items.map((i) => (
            <Text key={i.id}>
              • {i.name}
              {i.quantity ? ` — ${i.quantity}${i.unit ? ` ${i.unit}` : ""}` : ""}
              {i.claimedByName ? ` (claimed by ${i.claimedByName})` : ""}
            </Text>
          ))}
        </View>
      ))}
      {m.historyLabel ? (
        <Text style={{ color: tokens.color.muted, marginTop: tokens.space.md }}>
          {m.historyLabel}
        </Text>
      ) : null}
    </ScrollView>
  );
}
