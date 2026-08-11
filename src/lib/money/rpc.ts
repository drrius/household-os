import "server-only";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

type RpcArguments = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("Money command returned an unexpected payload");
}

export async function callMoneyRpc(
  command: string,
  buildArguments: (householdId: string) => RpcArguments,
): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    command,
    buildArguments(member.householdId),
  );

  if (error) {
    throw new Error(`${command} failed: ${error.message}`);
  }
  return asRecord(data);
}
