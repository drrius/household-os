import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HouseIcon } from "@/ui/icons/app-icons";

export type GateShellProps = {
  children: ReactNode;
  description?: ReactNode;
  title: ReactNode;
  titleId: string;
};

export function GateShell({
  children,
  description,
  title,
  titleId,
}: GateShellProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <HouseIcon />
          </span>
          <p className="font-heading text-lg font-bold">Our Home</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-2xl" id={titleId}>
              {title}
            </CardTitle>
            {description !== undefined && description !== null ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-4">{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
