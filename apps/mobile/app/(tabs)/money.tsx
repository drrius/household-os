import { useState } from "react";
import { Button, ScrollView, Text, TextInput, View } from "react-native";
import {
  dismissExpenseDraft,
  parseChfToCentimes,
  postManualExpense5050,
  recordFullSettlement,
} from "../../src/mutations/money";
import { useIdempotencyKey } from "../../src/mutations/useIdempotencyKey";
import { useMoney } from "../../src/money/useMoney";
import { useHouseholdRealtime } from "../../src/realtime/useHouseholdRealtime";
import { useSession } from "../../src/session/SessionProvider";
import { tokens } from "../../src/theme/tokens";

export default function MoneyScreen() {
  const session = useSession();
  const { state, refresh } = useMoney(session);
  useHouseholdRealtime(session, refresh);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const expenseKey = useIdempotencyKey();
  const settleKey = useIdempotencyKey();

  const run = async (fn: () => Promise<void>, rotate?: () => void) => {
    setPending(true);
    setFailure(null);
    try {
      await fn();
      rotate?.();
      refresh();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Failed");
    } finally {
      setPending(false);
    }
  };

  if (state.status === "loading") {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        testID="money-loading"
      >
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
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        testID="money-error"
      >
        <Text>Couldn&apos;t load money: {state.message}</Text>
        <Button title="Retry" onPress={state.retry} />
      </View>
    );
  }

  const m = state.model;
  const unpaidHero = m.hero.kind === "settled" ? null : m.hero;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.color.background }}
      contentContainerStyle={{ padding: tokens.space.md }}
      testID="money-screen"
    >
      <Text style={{ fontSize: tokens.type.title, fontWeight: "700" }}>
        Money
      </Text>
      {unpaidHero === null ? (
        <Text>Settled up.</Text>
      ) : (
        <View>
          <Text testID="money-hero">
            {unpaidHero.kind === "partner_owes_you"
              ? `${unpaidHero.partnerName} owes you `
              : `You owe ${unpaidHero.partnerName} `}
            {unpaidHero.amountLabel}
          </Text>
          <Button
            title="Settle up"
            disabled={pending}
            onPress={() =>
              void run(
                () =>
                  recordFullSettlement(
                    session,
                    unpaidHero.amountCents,
                    unpaidHero.kind,
                    settleKey.current(),
                  ),
                settleKey.rotate,
              )
            }
          />
        </View>
      )}
      {!m.hasOpeningBalance ? <Text>No opening balance yet.</Text> : null}

      <Text style={{ fontWeight: "600", marginTop: tokens.space.md }}>
        New expense (50/50, you paid)
      </Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Description"
        testID="expense-description"
        style={{
          borderWidth: 1,
          borderColor: tokens.color.border,
          borderRadius: tokens.radius.sm,
          padding: tokens.space.sm,
          marginTop: tokens.space.sm,
        }}
      />
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="12.40"
        keyboardType="decimal-pad"
        testID="expense-amount"
        style={{
          borderWidth: 1,
          borderColor: tokens.color.border,
          borderRadius: tokens.radius.sm,
          padding: tokens.space.sm,
          marginTop: tokens.space.sm,
        }}
      />
      <Button
        title="Post expense"
        disabled={pending || !description.trim() || !amount.trim()}
        onPress={() =>
          void run(async () => {
            const cents = parseChfToCentimes(amount);
            if (cents == null) throw new Error("Enter an amount like 12.40.");
            await postManualExpense5050(
              session,
              description,
              cents,
              expenseKey.current(),
            );
            expenseKey.rotate();
            setDescription("");
            setAmount("");
          })
        }
      />
      {failure ? (
        <Text style={{ color: tokens.color.danger }}>{failure}</Text>
      ) : null}

      <Text style={{ fontWeight: "600", marginTop: tokens.space.md }}>
        Drafts
      </Text>
      {m.drafts.length === 0 ? (
        <Text>No pending drafts.</Text>
      ) : (
        m.drafts.map((d) => (
          <View key={d.id}>
            <Text>
              • {d.title}
              {d.amountLabel ? ` — ${d.amountLabel}` : ""} ({d.meta})
            </Text>
            <Button
              title="Dismiss"
              disabled={pending}
              onPress={() => void run(() => dismissExpenseDraft(session, d.id))}
            />
          </View>
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
