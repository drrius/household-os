import Link from "next/link";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";

export const selectClassName =
  "h-9 w-full min-w-0 rounded-4xl border border-input bg-input/30 px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm";

export function FormPage({
  backHref,
  children,
  description,
  error,
  title,
}: {
  backHref: string;
  children: ReactNode;
  description: string;
  error?: string;
  title: string;
}) {
  const titleId = `form-${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
  return (
    <AppPage labelledBy={titleId}>
      <PageHeader
        titleId={titleId}
        title={title}
        trailing={
          <Link
            className={buttonVariants({
              className: "no-underline",
              variant: "outline",
            })}
            href={backHref}
          >
            Cancel
          </Link>
        }
      />
      <p className="text-sm text-muted-foreground">{description}</p>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t save</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardContent>{children}</CardContent>
      </Card>
    </AppPage>
  );
}

export function FormFields({
  action,
  children,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-5">
      {children}
      <button
        className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-fit")}
        type="submit"
      >
        {submitLabel}
      </button>
    </form>
  );
}

export function FormField({
  children,
  description,
  label,
}: {
  children: ReactNode;
  description?: string;
  label: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      {children}
      {description ? (
        <span className="font-normal text-muted-foreground">{description}</span>
      ) : null}
    </label>
  );
}

export function FormSection({
  children,
  legend,
}: {
  children: ReactNode;
  legend: string;
}) {
  return (
    <fieldset className="grid gap-4 border-t pt-5 first:border-t-0 first:pt-0">
      <legend className="font-heading font-bold">{legend}</legend>
      {children}
    </fieldset>
  );
}

export function CheckboxField({
  defaultChecked,
  label,
  name,
  value,
}: {
  defaultChecked?: boolean;
  label: string;
  name: string;
  value?: string;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
      <Checkbox defaultChecked={defaultChecked} name={name} value={value} />
      {label}
    </label>
  );
}
