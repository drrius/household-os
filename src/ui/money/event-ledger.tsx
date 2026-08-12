import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { MoneyViewModel } from "@/lib/read-models/money";
import { Amount } from "@/ui/layout/amount";
import { EmptyState } from "@/ui/layout/empty-state";
import { PageSection } from "@/ui/layout/page-section";

type EventLedgerProps = {
  events: MoneyViewModel["events"];
};

export function EventLedger({ events }: EventLedgerProps) {
  return (
    <PageSection title="Recent events" titleId="money-events-title">
      {events.length === 0 ? (
        <EmptyState title="No financial events yet">
          <p>
            Posted expenses, refunds, corrections, and settlements appear here.
          </p>
        </EmptyState>
      ) : (
        <Card className="gap-0 py-0">
          <CardContent className="px-0">
            <ol className="list-none">
              {events.map((event) => (
                <li
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b p-4 last:border-b-0"
                  key={event.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{event.title}</h3>
                      <Badge variant="secondary">{event.type}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.meta}
                    </p>
                  </div>
                  <p className="text-xl font-extrabold">
                    <Amount value={event.amount} />
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </PageSection>
  );
}
