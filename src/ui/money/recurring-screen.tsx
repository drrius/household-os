import Link from "next/link";
import { toggleRecurringRuleAction } from "@/app/(product)/money/recurring-actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MoneyRecurringRule } from "@/lib/read-models/money-recurring";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";
import { EmptyState } from "@/ui/layout/empty-state";
import { MoneyCommandForm } from "@/ui/money/command-form.client";

function RuleCard({ rule }: { rule: MoneyRecurringRule }) {
  const day =
    rule.schedule_kind === "weekly"
      ? [
          "",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ][rule.iso_weekday ?? 0]
      : `day ${rule.day_of_month}`;
  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">{rule.description}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {rule.schedule_kind === "weekly" ? "Every" : "Monthly on"} {day} ·
              Next draft {rule.next_occurrence_on}
            </p>
          </div>
          <Badge variant={rule.active ? "secondary" : "warning"}>
            {rule.active ? "Active" : "Paused"}
          </Badge>
        </div>
        <p className="text-2xl font-bold tabular-nums">
          {formatCentimesAsFrancs(rule.amount_cents)}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Link
            href={`/money/recurring/${rule.id}/edit`}
            className={buttonVariants({ variant: "outline" })}
          >
            Edit details
          </Link>
          <MoneyCommandForm
            action={toggleRecurringRuleAction}
            label={rule.active ? "Pause" : "Resume"}
            idempotencyKey={crypto.randomUUID()}
            fields={{ ruleId: rule.id, active: String(!rule.active) }}
          />
        </div>
        {!rule.active ? (
          <p className="text-sm text-muted-foreground">
            Resuming can create drafts for dates since the next draft date. Edit
            that date first if you want to skip them.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function RecurringScreen({
  rules,
}: {
  rules: readonly MoneyRecurringRule[];
}) {
  return (
    <AppPage labelledBy="recurring-title">
      <PageHeader
        title="Recurring expenses"
        titleId="recurring-title"
        trailing={
          <Link
            href="/money"
            className={buttonVariants({ variant: "outline" })}
          >
            Back to Money
          </Link>
        }
      />
      <p className="text-muted-foreground">
        Keep rent and other regular costs ready to review. Each occurrence
        creates a draft; nothing posts automatically.
      </p>
      <Link
        href="/money/recurring/new"
        className={buttonVariants({ className: "w-fit" })}
      >
        Add recurring expense
      </Link>
      {rules.length ? (
        <div className="grid gap-4">
          {rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      ) : (
        <EmptyState title="No recurring expenses yet">
          <p>Set up a weekly or monthly draft for something you share.</p>
        </EmptyState>
      )}
    </AppPage>
  );
}
