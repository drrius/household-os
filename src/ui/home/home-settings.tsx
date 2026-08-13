import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { SECURITY_PATH } from "@/lib/auth/paths";
import type { HomeViewModel } from "@/lib/read-models/home";

type SettingsRowProps = {
  hint: string;
  title: string;
};

function SettingsRow({ hint, title }: SettingsRowProps) {
  return (
    <li className="flex min-h-11 items-center justify-between gap-3 border-t py-3 first:border-t-0">
      <div className="grid min-w-0 gap-1">
        <strong>{title}</strong>
        <span className="text-sm text-muted-foreground">{hint}</span>
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
    <li className="border-t first:border-t-0">
      <Link
        className="-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-xl px-2 py-3 no-underline hover:bg-muted"
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
}: Pick<HomeViewModel, "storageUsedLabel">) {
  const storageHint =
    storageUsedLabel === null
      ? "Images only · Warning at 500 MB"
      : `${storageUsedLabel} used · Warning at 500 MB`;

  return (
    <Card>
      <CardContent>
        <ul className="list-none" aria-label="Household settings">
          <SettingsRow
            hint="Coming later · In-app notifications, optional push, and a personal digest"
            title="Notifications & digest"
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
          <SettingsRow hint={storageHint} title="Attachment storage" />
        </ul>
      </CardContent>
    </Card>
  );
}
