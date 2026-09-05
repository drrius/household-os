"use client";

import { Button } from "@/components/ui/button";
import {
  pushSetupOperations,
  type PushSetupEnrollment,
  type PushSetupOperations,
} from "@/lib/notifications/push-status-browser";
import {
  useDevicePushTest,
  usePushEnrollment,
} from "@/ui/notifications/use-push-enrollment.client";

function enrollmentCopy(enrollment: PushSetupEnrollment): string {
  switch (enrollment.status) {
    case "unsupported":
      return "This browser does not support Web Push. Inbox still works.";
    case "missing-vapid":
      return "Push is not configured on this server yet. Inbox still works.";
    case "needs-install":
      return "Install Household OS to the Home Screen before enabling push on iOS.";
    case "denied":
      return "Notifications are blocked. Allow them in this browser’s site settings, then check again. Inbox still works.";
    case "needs-permission":
      return "Optional. Turn on push to hear about partner updates away from the app.";
    case "unsubscribed":
      return "Permission is granted. Enable this device to receive push alerts.";
    case "unregistered":
      return "This browser has a subscription, but it is not enabled for your account. Reconnect this device to receive alerts.";
    case "unavailable":
      return "We could not confirm whether push is enabled on this device.";
    case "subscribed":
      return "Push is enabled for your account on this device. You can turn it off any time.";
  }
}

function DeviceTest({
  endpoint,
  operations,
  disabled,
}: {
  endpoint: string;
  operations: PushSetupOperations;
  disabled: boolean;
}) {
  const { test, error, pending, send, check, reset } = useDevicePushTest(
    endpoint,
    operations,
  );
  const copy =
    test?.status === "accepted"
      ? "Accepted by the push service. This does not confirm that your device displayed it. Check notification settings or Focus mode if nothing appeared."
      : test?.status === "failed"
        ? "The test could not be sent to this device. Check push status and reconnect if needed."
        : "Queued for this device. The dispatcher runs every minute; setup or connection problems can delay it.";
  return (
    <div className="grid gap-3 border-t border-border pt-4">
      <div>
        <h3 className="text-sm font-medium">Try a notification</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Only this device receives the test. Up to one per minute and five per
          day across your devices.
        </p>
      </div>
      {test ? (
        <p className="text-sm" role="status">
          {copy}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!test ? (
          <Button
            variant="secondary"
            type="button"
            onClick={send}
            disabled={pending || disabled}
          >
            {pending
              ? "Queuing test…"
              : error
                ? "Retry test"
                : "Send test to this device"}
          </Button>
        ) : null}
        {test?.status === "queued" ? (
          <Button
            variant="secondary"
            type="button"
            onClick={check}
            disabled={pending || disabled}
          >
            {pending ? "Checking test…" : "Check test status"}
          </Button>
        ) : null}
        {test && test.status !== "queued" ? (
          <Button
            variant="outline"
            type="button"
            onClick={reset}
            disabled={pending || disabled}
          >
            Start another test
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function PushEnrollmentPanel({
  operations = pushSetupOperations,
}: {
  operations?: PushSetupOperations;
}) {
  const { enrollment, error, pending, subscribe, unsubscribe, refresh } =
    usePushEnrollment(operations);
  if (enrollment === null)
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Checking this device…
      </p>
    );
  const canSubscribe = [
    "needs-permission",
    "unsubscribed",
    "unregistered",
  ].includes(enrollment.status);
  return (
    <div className="grid gap-4" aria-busy={pending}>
      <p className="text-sm text-muted-foreground" role="status">
        {enrollmentCopy(enrollment)}
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canSubscribe ? (
          <Button
            disabled={pending}
            onClick={subscribe}
            type="button"
            variant="secondary"
          >
            {pending
              ? "Connecting…"
              : enrollment.status === "unregistered"
                ? "Reconnect this device"
                : "Enable push on this device"}
          </Button>
        ) : null}
        {enrollment.status === "subscribed" ? (
          <Button
            disabled={pending}
            onClick={unsubscribe}
            type="button"
            variant="outline"
          >
            {pending ? "Updating…" : "Disable push on this device"}
          </Button>
        ) : null}
        <Button
          disabled={pending}
          onClick={refresh}
          type="button"
          variant="outline"
        >
          {pending ? "Checking…" : "Check push status"}
        </Button>
      </div>
      {enrollment.status === "subscribed" ? (
        <DeviceTest
          key={enrollment.endpoint}
          endpoint={enrollment.endpoint}
          operations={operations}
          disabled={pending}
        />
      ) : null}
    </div>
  );
}
