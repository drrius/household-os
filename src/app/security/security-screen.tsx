import "server-only";
import type { ReactNode } from "react";
import { SignOutControl } from "./sign-out-control";
import { PasskeyLoader } from "./passkey-loader.client";
import { GateShell } from "@/ui/layout/gate-shell";

export function SecurityScreen({ children }: { children?: ReactNode }) {
  return (
    <GateShell
      description="Passkeys are the only normal sign-in method. Register a second authenticator when you can."
      title="Security"
      titleId="security-title"
    >
      {children ?? <PasskeyLoader />}
      <SignOutControl />
    </GateShell>
  );
}
