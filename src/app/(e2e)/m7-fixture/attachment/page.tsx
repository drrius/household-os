import { notFound } from "next/navigation";
import { AttachmentField } from "@/ui/attachments/attachment-field.client";
import { AppShell } from "@/ui/shell/app-shell";
import { Button } from "@/components/ui/button";

export default function AttachmentFixture() {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  return (
    <AppShell>
      <section className="grid max-w-lg gap-6">
        <h1 className="font-heading text-3xl">Attach a receipt</h1>
        <form className="grid gap-4">
          <AttachmentField
            name="receiptPath"
            label="Receipt"
            purpose="receipts"
          />
          <Button type="submit">Save</Button>
        </form>
      </section>
    </AppShell>
  );
}
