import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { SECURITY_PATH } from "@/lib/auth/paths";
import type { HomeViewModel } from "@/lib/read-models/home";

type SettingsRowProps = {
  hint: ReactNode;
  title: string;
};

function SettingsRow({ hint, title }: SettingsRowProps) {
  return (
    <li className="flex min-h-11 items-center justify-between gap-3 border-t py-3 first:border-t-0">
      <div className="grid min-w-0 gap-1">
        <strong>{title}</strong>
        <div className="text-sm text-muted-foreground">{hint}</div>
      </div>
    </li>
  );
}

function SettingsLinkRow({
  href,
  hint,
  title,
}: SettingsRowProps & { href: string }) {
  return (
    <li className="border-t py-1 first:border-t-0">
      <Link
        className="-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 py-2 no-underline hover:bg-muted/70"
        href={href}
      >
        <span className="grid min-w-0 gap-1">
          <strong>{title}</strong>
          <span className="text-sm text-muted-foreground">{hint}</span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      </Link>
    </li>
  );
}

export function SettingsList({
  storageUsedLabel,
  storageUsage,
}: Pick<HomeViewModel, "storageUsedLabel"> & { storageUsage?: ReactNode }) {
  const storageHint =
    storageUsedLabel === null
      ? "Private photos & PDFs · Up to 4 MB each"
      : `${storageUsedLabel} used · Up to 4 MB each`;

  return (
    <Card>
      <CardContent>
        <ul className="list-none" aria-label="Household settings">
          <SettingsLinkRow
            hint="In-app inbox, optional push, and a personal digest"
            href="/home/notifications"
            title="Notifications & digest"
          />
          <SettingsLinkRow
            hint="Partner notices, reminders, and digests"
            href="/home/inbox"
            title="Inbox"
          />
          <SettingsLinkRow
            hint="Manage authenticators and recovery access"
            href={SECURITY_PATH}
            title="Passkeys & recovery"
          />
          <SettingsLinkRow
            hint="Household name, areas, and pets"
            href="/home/setup"
            title="Household settings"
          />
          <SettingsRow
            hint={storageUsage ?? storageHint}
            title="Attachment storage"
          />
        </ul>
      </CardContent>
    </Card>
  );
}
