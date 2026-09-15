import { Button, ScrollView, Text, View } from "react-native";
import { markInboxRead } from "../../src/mutations/plan-home";
import { useHome } from "../../src/home/useHome";
import { useSession } from "../../src/session/SessionProvider";
import { tokens } from "../../src/theme/tokens";

export default function HomeScreen() {
  const session = useSession();
  const { state, refresh } = useHome(session);

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} testID="home-loading">
        <Text>Loading home…</Text>
      </View>
    );
  }
  if (state.status === "signed-out") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Sign in to see home.</Text>
      </View>
    );
  }
  if (state.status === "error") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} testID="home-error">
        <Text>Couldn&apos;t load home: {state.message}</Text>
        <Button title="Retry" onPress={state.retry} />
      </View>
    );
  }

  const { model: m, inbox } = state;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.color.background }}
      contentContainerStyle={{ padding: tokens.space.md }}
      testID="home-screen"
    >
      <Text style={{ fontSize: tokens.type.title, fontWeight: "700" }}>
        {m.householdLabel}
      </Text>
      <Text>
        {m.members.map((x) => x.displayName).join(" · ")} · Inbox unread:{" "}
        {inbox.unreadCount}
      </Text>

      <Text style={{ fontWeight: "600", marginTop: tokens.space.md }}>Routines</Text>
      {m.routines.map((r) => (
        <Text key={r.id}>
          • {r.title} ({r.areaName}
          {r.paused ? ", paused" : ""})
        </Text>
      ))}

      <Text style={{ fontWeight: "600", marginTop: tokens.space.md }}>Pets</Text>
      {m.pets.length === 0 ? (
        <Text>No pets.</Text>
      ) : (
        m.pets.map((p) => <Text key={p.id}>• {p.name}</Text>)
      )}

      <Text style={{ fontWeight: "600", marginTop: tokens.space.md }}>Inbox</Text>
      {inbox.unreadCount > 0 ? (
        <Button
          title={`Mark ${inbox.unreadCount} read`}
          onPress={() =>
            void markInboxRead(
              session,
              inbox.items.filter((n) => !n.read).map((n) => n.id)
            ).then(refresh)
          }
        />
      ) : null}
      {inbox.items.length === 0 ? (
        <Text>Inbox is clear.</Text>
      ) : (
        inbox.items.map((n) => (
          <Text key={n.id}>
            • {n.title}
            {n.read ? "" : " (unread)"}
          </Text>
        ))
      )}

      <Text style={{ fontWeight: "600", marginTop: tokens.space.md }}>Activity</Text>
      {m.activity.length === 0 ? (
        <Text>No recent activity.</Text>
      ) : (
        m.activity.map((a) => <Text key={a.id}>• {a.title}</Text>)
      )}
    </ScrollView>
  );
}
