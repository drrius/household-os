import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { attachmentUsage } from "@/domain/attachments/usage";
import { AttachmentUsageDisplay } from "@/ui/attachments/usage";
import { SettingsList } from "@/ui/home/home-settings";
async function DelayedUsage() {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return <AttachmentUsageDisplay usage={attachmentUsage("0")} />;
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const { state = "zero" } = await searchParams;
  const recovered =
    (await cookies()).get("usage-fixture-recovered")?.value === "1";
  const sizes: Record<string, string | null> = {
    zero: "0",
    below: "499999999",
    threshold: "500000000",
    above: "900719925474099312345",
    error: recovered ? "0" : null,
  };
  if (state !== "loading" && !(state in sizes)) notFound();
  const content =
    state === "loading" ? (
      <Suspense
        fallback={<AttachmentUsageDisplay usage={{ status: "loading" }} />}
      >
        <DelayedUsage />
      </Suspense>
    ) : (
      <AttachmentUsageDisplay usage={attachmentUsage(sizes[state])} />
    );
  return (
    <main className="mx-auto w-full max-w-3xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">Household settings</h1>
      <SettingsList storageUsedLabel={null} storageUsage={content} />
    </main>
  );
}
