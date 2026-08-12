import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GroceriesViewModel } from "@/lib/read-models/groceries";
import { ProgressMeter } from "@/ui/layout/progress-meter";

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
      <Card className="bg-success-soft">
        <CardHeader>
          <CardTitle id="live-shopping-title">Live shopping session</CardTitle>
          <CardAction>
            <Badge variant="success">Live</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <strong>
                {session.isMine
                  ? "Your shopping session is open"
                  : `${session.memberName} is shopping now`}
              </strong>
              <p className="text-xs text-muted-foreground">{progressLabel}</p>
            </div>
            {session.isMine ? (
              <Badge variant="success">Your session</Badge>
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
        </CardContent>
      </Card>
    </section>
  );
}
