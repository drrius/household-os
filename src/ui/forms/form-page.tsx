import Link from "next/link";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";

export { CheckboxField } from "@/ui/forms/checkbox-field.client";
export { FormField } from "@/ui/forms/form-field.client";
export { FormFields } from "@/ui/forms/form-fields.client";

export function FormPage({
  backHref,
  backLabel = "Cancel",
  children,
  description,
  error,
  title,
}: {
  backHref: string;
  backLabel?: string;
  children: ReactNode;
  description: string;
  error?: string;
  title: string;
}) {
  const titleId = `form-${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
  return (
    <AppPage labelledBy={titleId}>
      <div className="flex w-full max-w-2xl flex-col gap-4">
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
              {backLabel}
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
      </div>
    </AppPage>
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
    <div className="border-border py-6 first-of-type:pt-0 last-of-type:pb-0 not-first-of-type:border-t">
      <FieldSet>
        <FieldLegend>{legend}</FieldLegend>
        <FieldGroup className="gap-4">{children}</FieldGroup>
      </FieldSet>
    </div>
  );
}
