import { PasskeyManager } from "@/app/security/passkey-manager";
import { requireMemberContext } from "@/lib/auth/member-context";
import type { PasskeySummary } from "@/lib/auth/passkeys";
import { createClient } from "@/lib/supabase/server";

async function loadPasskeys(): Promise<PasskeySummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.passkey.list();

  if (error) {
    throw new Error(`Unable to list passkeys: ${error.message}`);
  }

  return (data ?? []).map((passkey) => ({
    id: passkey.id,
    friendlyName: passkey.friendly_name ?? null,
    createdAt: passkey.created_at,
    lastUsedAt: passkey.last_used_at ?? null,
  }));
}

export default async function SecurityPage() {
  await requireMemberContext();
  const passkeys = await loadPasskeys();

  return (
    <main>
      <h1>Security</h1>
      <p>
        Passkeys are the only normal sign-in method. Register a second
        authenticator when you can.
      </p>
      <PasskeyManager initialPasskeys={passkeys} />
    </main>
  );
}
