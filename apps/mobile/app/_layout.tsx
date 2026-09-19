import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Button, Text, View } from "react-native";
import { SignInScreen } from "../src/auth/SignInScreen";
import {
  SessionProvider,
  useReloadSession,
  useSession,
  useSignOut,
} from "../src/session/SessionProvider";
import { tokens } from "../src/theme/tokens";

function SessionErrorScreen({ message }: { message: string }) {
  const reload = useReloadSession();
  const signOut = useSignOut();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: tokens.space.lg,
        backgroundColor: tokens.color.background,
      }}
      testID="session-error"
    >
      <Text style={{ textAlign: "center", marginBottom: tokens.space.md }}>
        Couldn&apos;t load your session: {message}
      </Text>
      <Button title="Retry" onPress={reload} />
      <Button title="Sign out" onPress={() => void signOut()} />
    </View>
  );
}

function GatedApp() {
  const session = useSession();

  switch (session.status) {
    case "loading":
      return (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tokens.color.background,
          }}
          testID="session-loading"
        >
          <Text>Loading…</Text>
        </View>
      );
    case "signed-out":
      return <SignInScreen reason="signed-out" />;
    case "not-a-member":
      return <SignInScreen reason="not-a-member" />;
    case "error":
      return <SessionErrorScreen message={session.message} />;
    case "ready":
    case "mock":
      return (
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      );
    default: {
      const _exhaustive: never = session;
      return _exhaustive;
    }
  }
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="auto" />
      <GatedApp />
    </SessionProvider>
  );
}
