import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { AppleSignInCancelledError, signInWithApple } from "../lib/auth-apple";
import { tokens } from "../theme/tokens";

const NOT_A_MEMBER_COPY =
  "This Apple ID is not a household member. Sign-in was closed so a new account cannot open the home. Ask the person who set up Our Home to link this Apple ID to your existing account, then try again.";

export function SignInScreen({
  reason,
}: {
  reason: "signed-out" | "not-a-member";
}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(
    reason === "not-a-member" ? NOT_A_MEMBER_COPY : null,
  );

  useEffect(() => {
    void AppleAuthentication.isAvailableAsync().then(setAvailable);
  }, []);

  useEffect(() => {
    if (reason === "not-a-member") {
      setMessage(NOT_A_MEMBER_COPY);
    }
  }, [reason]);

  const onPress = async () => {
    if (pending) return;
    setPending(true);
    setMessage(null);
    try {
      await signInWithApple();
    } catch (error) {
      if (error instanceof AppleSignInCancelledError) {
        return;
      }
      setMessage(error instanceof Error ? error.message : "Sign in failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.color.background,
        alignItems: "center",
        justifyContent: "center",
        padding: tokens.space.lg,
      }}
      testID="sign-in-screen"
    >
      <Text
        style={{
          fontSize: tokens.type.title,
          fontWeight: "700",
          color: tokens.color.text,
          marginBottom: tokens.space.sm,
        }}
      >
        Household OS
      </Text>
      <Text
        style={{
          fontSize: tokens.type.body,
          color: tokens.color.muted,
          textAlign: "center",
          marginBottom: tokens.space.lg,
        }}
      >
        Sign in with the Apple ID linked to this household. The web app stays
        passkey-only.
      </Text>
      {available === true ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={tokens.radius.md}
          style={{ width: 280, height: 44, opacity: pending ? 0.6 : 1 }}
          onPress={() => {
            void onPress();
          }}
        />
      ) : null}
      {available === false ? (
        <Text
          style={{
            fontSize: tokens.type.body,
            color: tokens.color.muted,
            textAlign: "center",
          }}
          testID="sign-in-unavailable"
        >
          Sign in with Apple needs an iPhone and a development or TestFlight
          build.
        </Text>
      ) : null}
      {message ? (
        <Text
          style={{
            marginTop: tokens.space.md,
            color: tokens.color.danger,
            textAlign: "center",
            fontSize: tokens.type.meta,
          }}
          testID="sign-in-message"
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}
