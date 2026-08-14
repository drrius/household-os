"use client";

import { Button } from "@/components/ui/button";
import type { PushEnrollment } from "@/lib/pwa/push-enrollment";
import { usePushEnrollment } from "@/ui/notifications/use-push-enrollment.client";

function enrollmentCopy(enrollment: PushEnrollment): string {
  switch (enrollment.status) {
    case "unsupported":
      return "This browser does not support Web Push.";
    case "missing-vapid":
      return "Push is not configured on this server yet.";
    case "needs-install":
      return "Install Household OS to the Home Screen before enabling push on iOS.";
    case "denied":
      return "Notifications are blocked in browser settings. Inbox still works.";
    case "needs-permission":
      return "Optional. Turn on push to hear about partner updates away from the app.";
    case "unsubscribed":
      return "Permission is granted. Subscribe this device to receive push alerts.";
    case "subscribed":
      return "This device is subscribed. You can turn push off any time.";
    default: {
      const _exhaustive: never = enrollment;
      return _exhaustive;
    }
  }
}

function EnrollmentActions({
  enrollment,
  pending,
  onSubscribe,
  onUnsubscribe,
}: {
  enrollment: PushEnrollment;
  pending: boolean;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
}) {
  const canSubscribe =
    enrollment.status === "needs-permission" ||
    enrollment.status === "unsubscribed";
  const canUnsubscribe = enrollment.status === "subscribed";

  return (
    <>
      {canSubscribe ? (
        <Button
          disabled={pending}
          onClick={onSubscribe}
          type="button"
          variant="secondary"
        >
          Enable push on this device
        </Button>
      ) : null}
      {canUnsubscribe ? (
        <Button
          disabled={pending}
          onClick={onUnsubscribe}
          type="button"
          variant="outline"
        >
          Disable push on this device
        </Button>
      ) : null}
    </>
  );
}

export function PushEnrollmentPanel() {
  const { enrollment, error, pending, subscribe, unsubscribe } =
    usePushEnrollment();

  if (enrollment === null) {
    return (
      <p className="text-sm text-muted-foreground">Checking this device…</p>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {enrollmentCopy(enrollment)}
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <EnrollmentActions
        enrollment={enrollment}
        onSubscribe={subscribe}
        onUnsubscribe={unsubscribe}
        pending={pending}
      />
    </div>
  );
}
