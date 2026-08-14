export type EnvironmentReader = (name: string) => string | undefined;

export type PushDispatchAuthentication = {
  credential: string;
};

function addCredential(credentials: Set<string>, value: unknown): void {
  if (typeof value === "string" && value.trim().length > 0) {
    credentials.add(value);
  }
}

function configuredServiceCredentials(
  readEnvironment: EnvironmentReader,
): Set<string> {
  const credentials = new Set<string>();
  const namedKeys = readEnvironment("SUPABASE_SECRET_KEYS");

  if (namedKeys) {
    try {
      const parsed: unknown = JSON.parse(namedKeys);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        for (const value of Object.values(parsed)) {
          addCredential(credentials, value);
        }
      }
    } catch {
      // A malformed named-key map must never authenticate a request. Legacy
      // fallbacks are still considered so local development remains usable.
    }
  }

  addCredential(credentials, readEnvironment("SUPABASE_SECRET_KEY"));
  addCredential(credentials, readEnvironment("SUPABASE_SERVICE_ROLE_KEY"));
  return credentials;
}

function equalCredential(left: string, right: string): boolean {
  const comparedLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < comparedLength; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

export function authenticatePushDispatch(
  request: Request,
  readEnvironment: EnvironmentReader,
): PushDispatchAuthentication | null {
  const credential = request.headers.get("apikey")?.trim();
  if (!credential) {
    return null;
  }

  const accepted = configuredServiceCredentials(readEnvironment);
  for (const candidate of accepted) {
    if (equalCredential(credential, candidate)) {
      return { credential };
    }
  }

  return null;
}
