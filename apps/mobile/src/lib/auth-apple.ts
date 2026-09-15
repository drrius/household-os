import * as AppleAuthentication from "expo-apple-authentication";

export async function signInWithApple(): Promise<void> {
  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("Sign in with Apple is not available on this device.");
  }
  throw new Error(
    "Sign in with Apple is not wired to Supabase yet. Needs Apple Team ID + bundle ID ch.household.os, then supabase.auth.signInWithIdToken."
  );
}
