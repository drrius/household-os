"use client";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { EchoedInput } from "@/ui/forms/echoed-control.client";

export function DiscardFixtureControls({ seed }: { seed: string }) {
  const router = useRouter();
  const { pending } = useFormStatus();
  return (
    <>
      <label>
        Stable value
        <EchoedInput name="stable" initialValue="Same" disabled={pending} />
      </label>
      <label>
        Refresh default
        <EchoedInput name="refresh" initialValue={seed} />
      </label>
      <output data-testid="refresh-seed">{seed}</output>
      <button type="button" onClick={() => router.refresh()}>
        Refresh server defaults
      </button>
    </>
  );
}
