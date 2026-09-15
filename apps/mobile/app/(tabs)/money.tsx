import { Button, ScrollView, Text, View } from "react-native";
import { useMoney } from "../../src/money/useMoney";
import { useSession } from "../../src/session/SessionProvider";
import { tokens } from "../../src/theme/tokens";

export default function MoneyScreen() {
  const session = useSession();
  const state = useMoney(session);

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} testID="money-loading">
        <Text>Loading money…</Text>
      </View>
    );
  }
  if (state.status === "signed-out") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Sign in to see money.</Text>
      </View>
    );
  }
  if (state.status === "error") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} testID="money-error">
        <Text>Couldn&apos;t load money: {state.message}</Text>
        <Button title="Retry" onPress={state.retry} />
      </View>
    );
  }

  const m = state.model;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.color.background }}
      contentContainerStyle={{ padding: tokens.space.md }}
      testID="money-screen"
    >
      <Text style={{ fontSize: tokens.type.title, fontWeight: "700" }}>Money</Text>
      {m.hero.kind === "settled" ? (
        <Text>Settled up.</Text>
      ) : (
        <Text testID="money-hero">
          {m.hero.kind === "partner_owes_you" ? `${m.hero.partnerName} owes you ` : `You owe ${m.hero.partnerName} `}
          {m.hero.amountLabel}
        </Text>
      )}
      {!m.hasOpeningBalance ? <Text>No opening balance yet.</Text> : null}

      <Text style={{ fontWeight: "600", marginTop: tokens.space.md }}>Drafts</Text>
      {m.drafts.length === 0 ? (
        <Text>No pending drafts.</Text>
      ) : (
        m.drafts.map((d) => (
          <Text key={d.id}>
            • {d.title}
            {d.amountLabel ? ` — ${d.amountLabel}` : ""} ({d.meta})
          </Text>
        ))
      )}

      <Text style={{ fontWeight: "600", marginTop: tokens.space.md }}>
        Recent events
      </Text>
      {m.events.map((e) => (
        <Text key={e.id}>
          • {e.title} — {e.amountLabel} ({e.balanceDeltaLabel}) · {e.meta}
        </Text>
      ))}
      <Text style={{ color: tokens.color.muted, marginTop: tokens.space.md }}>
        Balances are server-derived. Drafts never count until confirmed.
      </Text>
    </ScrollView>
  );
}
