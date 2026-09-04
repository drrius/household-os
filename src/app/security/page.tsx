import { SignOutControl } from "@/app/security/sign-out-control";
import { PasskeyManager } from "@/app/security/passkey-manager";
import { requireMemberContext } from "@/lib/auth/member-context";
import type { PasskeySummary } from "@/lib/auth/passkeys";
import { createClient } from "@/lib/supabase/server";
import { GateShell } from "@/ui/layout/gate-shell";

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
    <GateShell
      description="Passkeys are the only normal sign-in method. Register a second authenticator when you can."
      title="Security"
      titleId="security-title"
    >
      <PasskeyManager initialPasskeys={passkeys} />
      <SignOutControl />
    </GateShell>
  );
}
