import { useState } from "react";
import { Button, ScrollView, Text, TextInput, View } from "react-native";
import {
  addGroceryItem,
  claimGroceryItem,
  finishShoppingSession,
  startShoppingSession,
} from "../../src/mutations/groceries";
import { useGroceries } from "../../src/groceries/useGroceries";
import { useSession } from "../../src/session/SessionProvider";
import { tokens } from "../../src/theme/tokens";

export default function GroceriesScreen() {
  const session = useSession();
  const { state, refresh } = useGroceries(session);
  const [name, setName] = useState("");
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
      ) : (
        <Button
          title="Start shopping"
          disabled={pending}
          onPress={() => void run(() => startShoppingSession(session))}
        />
      )}
      {m.liveSession?.isMine ? (
        <Button
          title="Finish shopping"
          disabled={pending}
          onPress={() =>
            void run(() => finishShoppingSession(session, m.liveSession?.id ?? ""))
          }
        />
      ) : null}

      <View style={{ flexDirection: "row", gap: tokens.space.sm, marginTop: tokens.space.md }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Add item"
          testID="grocery-name-input"
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: tokens.color.border,
            borderRadius: tokens.radius.sm,
            padding: tokens.space.sm,
          }}
        />
        <Button
          title="Add"
          disabled={pending || !name.trim()}
          onPress={() =>
            void run(async () => {
              await addGroceryItem(session, name);
              setName("");
            })
          }
        />
      </View>
      {failure ? <Text style={{ color: tokens.color.danger }}>{failure}</Text> : null}

      {m.categories.map((c) => (
        <View key={c.id} style={{ marginTop: tokens.space.md }}>
          <Text style={{ fontWeight: "600" }}>{c.name}</Text>
          {c.items.map((i) => (
            <View key={i.id}>
              <Text>
                • {i.name}
                {i.quantity ? ` — ${i.quantity}${i.unit ? ` ${i.unit}` : ""}` : ""}
                {i.claimedByName ? ` (claimed by ${i.claimedByName})` : ""}
              </Text>
              {!i.claimedByName && m.liveSession ? (
                <Button
                  title="Claim"
                  disabled={pending}
                  onPress={() =>
                    void run(() =>
                      claimGroceryItem(session, m.liveSession?.id ?? "", i.id)
                    )
                  }
                />
              ) : null}
            </View>
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
