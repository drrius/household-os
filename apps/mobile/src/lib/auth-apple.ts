import * as AppleAuthentication from "expo-apple-authentication";
import { completeAppleIdTokenSignIn } from "./complete-id-token-sign-in";
import { loadHouseholdMembership } from "./household-membership";
import { supabase } from "./supabase";

export { NotAHouseholdMemberError } from "./complete-id-token-sign-in";

export class AppleSignInUnavailableError extends Error {
  readonly name = "AppleSignInUnavailableError";

  constructor() {
    super("Sign in with Apple is not available on this device.");
  }
}

export class AppleSignInCancelledError extends Error {
  readonly name = "AppleSignInCancelledError";

  constructor() {
    super("Sign in with Apple was cancelled.");
  }
}

export class AppleIdentityTokenMissingError extends Error {
  readonly name = "AppleIdentityTokenMissingError";

  constructor() {
    super("Apple did not return an identity token.");
  }
}

function isAppleCancel(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ERR_REQUEST_CANCELED"
  );
}

export async function signInWithApple(): Promise<void> {
  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    throw new AppleSignInUnavailableError();
  }

  let identityToken: string;
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (credential.identityToken === null) {
      throw new AppleIdentityTokenMissingError();
    }
    identityToken = credential.identityToken;
  } catch (error) {
    if (isAppleCancel(error)) {
      throw new AppleSignInCancelledError();
    }
    throw error;
  }

  await completeAppleIdTokenSignIn({
    token: identityToken,
    auth: supabase.auth,
    loadMembership: loadHouseholdMembership,
  });
}
