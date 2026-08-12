import type { MoneyViewModel } from "@/lib/read-models/money";
import { Amount } from "@/ui/primitives/amount";
import { EmptyState } from "@/ui/primitives/empty-state";
import { PageSection } from "@/ui/primitives/page-section";
import { StatusPill } from "@/ui/primitives/status-pill";

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
        <ol className="card money-ledger">
          {events.map((event) => (
            <li className="money-ledger__row" key={event.id}>
              <div className="money-row__main">
                <div className="u-cluster">
                  <h3>{event.title}</h3>
                  <StatusPill>{event.type}</StatusPill>
                </div>
                <p className="money-row__meta">{event.meta}</p>
              </div>
              <p className="money-row__amount">
                <Amount value={event.amount} />
              </p>
            </li>
          ))}
        </ol>
      )}
    </PageSection>
  );
}
