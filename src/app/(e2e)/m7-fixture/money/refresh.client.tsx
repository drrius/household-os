"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
export function RefreshMoneyFixture({ revision }: { revision: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <output data-testid="server-revision">{revision}</output>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        Receive partner update
      </button>
    </div>
  );
}
