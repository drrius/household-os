import type { GroceriesViewModel } from "@/lib/read-models/groceries";
import { Button } from "@/ui/primitives/button";
import { Card } from "@/ui/primitives/card";
import { ProgressMeter } from "@/ui/primitives/progress-meter";
import { StatusPill } from "@/ui/primitives/status-pill";

import styles from "./shopping-session-rail.module.css";

type LiveSession = NonNullable<GroceriesViewModel["liveSession"]>;

type ShoppingSessionRailProps = {
  joinAction: () => Promise<void>;
  session: LiveSession;
};

function claimedCountLabel(session: LiveSession): string {
  return `${session.claimedCount} of ${session.totalCount} in cart`;
}

export function ShoppingSessionRail({
  joinAction,
  session,
}: ShoppingSessionRailProps) {
  const progressLabel = claimedCountLabel(session);

  return (
    <section aria-labelledby="live-shopping-title">
      <Card
        className={styles.rail}
        header={
          <>
            <h2 className={styles.heading} id="live-shopping-title">
              Live shopping session
            </h2>
            <StatusPill tone="success">Live</StatusPill>
          </>
        }
        tone="success"
      >
        <div className={styles.sessionSummary}>
          <div className={styles.sessionCopy}>
            <strong>
              {session.isMine
                ? "Your shopping session is open"
                : `${session.memberName} is shopping now`}
            </strong>
            <p>{progressLabel}</p>
          </div>
          {session.isMine ? (
            <StatusPill tone="success">Your session</StatusPill>
          ) : (
            <form action={joinAction}>
              <Button type="submit">Join session</Button>
            </form>
          )}
        </div>
        {session.totalCount > 0 ? (
          <ProgressMeter
            id="shopping-session-progress"
            label="Cart progress"
            max={session.totalCount}
            value={session.claimedCount}
            valueLabel={progressLabel}
          />
        ) : null}
      </Card>
    </section>
  );
}
