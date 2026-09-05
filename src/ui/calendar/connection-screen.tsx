"use client";
import Link from "next/link";
import type { AppleCalendar } from "@/lib/calendar/caldav";
import type { ConnectionSummary } from "@/lib/calendar/rows";
import {
  connectCalendarAction,
  selectCalendarAction,
  syncCalendarAction,
  disconnectCalendarAction,
} from "@/lib/calendar/actions";
import { Input } from "@/components/ui/input";
import { FormPage, FormField, FormFields } from "@/ui/forms/form-page";
import { EchoedSelect } from "@/ui/forms/form-select.client";
import { CalendarActionButton } from "./action-button.client";
export function ConnectionScreen({
  connection,
  calendars,
  configured,
  error,
}: {
  connection: ConnectionSummary | null;
  calendars: AppleCalendar[];
  configured: boolean;
  error?: string;
}) {
  return (
    <FormPage
      title="Your iCloud calendar"
      backHref="/plan/calendar"
      description="Keep using the shared calendar you already love. Changes move both ways whenever you sync."
    >
      <div className="grid gap-6">
        {!configured ? (
          <div className="grid gap-3 rounded-xl bg-secondary p-4">
            <h2 className="font-medium">One server setup step</h2>
            <p className="text-sm">
              The app needs a private encryption key before it can save an Apple
              connection. Set <code>HOUSEHOLD_CALENDAR_ENCRYPTION_KEY</code> on
              the server to a base64-encoded random 32-byte key, then restart
              the app. Keep the same key across deployments.
            </p>
            <p className="text-sm">
              After that, connect below with an Apple app-specific password.
              Your regular Apple password is never needed.
            </p>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AppleConnectForm connection={connection} configured={configured} />
        <CalendarPicker
          connection={connection}
          calendars={calendars}
          configured={configured}
        />
        <ConnectedCalendarStatus connection={connection} />
        {connection ? (
          <details className="rounded-xl border p-4">
            <summary className="min-h-11 cursor-pointer text-sm font-medium">
              Disconnect or choose another calendar
            </summary>
            <p className="mb-4 text-sm text-muted-foreground">
              Disconnect keeps your imported events here and leaves Apple
              Calendar untouched. Pending changes will stay here. You can then
              connect again and choose another calendar. Revoke the old
              app-specific password in your Apple Account if you no longer need
              it.
            </p>
            <CalendarActionButton
              action={disconnectCalendarAction}
              label="Disconnect iCloud"
            />
          </details>
        ) : null}
      </div>
    </FormPage>
  );
}

function AppleConnectForm({
  connection,
  configured,
}: {
  connection: ConnectionSummary | null;
  configured: boolean;
}) {
  return (
    <>
      {!connection && configured ? (
        <>
          <div className="text-sm text-muted-foreground">
            <p>
              Create an app-specific password in your{" "}
              <a
                href="https://account.apple.com/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Apple Account
              </a>
              , under Sign-In and Security. Two-factor authentication must be
              enabled.
            </p>
            <p className="mt-2">
              Use an account that already has access to your shared calendar.
              The password is encrypted on the server.
            </p>
            <a
              className="mt-2 inline-block underline"
              href="https://support.apple.com/en-us/102654"
              target="_blank"
              rel="noreferrer"
            >
              Apple’s instructions
            </a>
          </div>
          <FormFields
            action={connectCalendarAction}
            submitLabel="Connect Apple Account"
          >
            <FormField label="Apple Account email">
              <Input
                type="email"
                name="username"
                autoComplete="username"
                required
                maxLength={254}
              />
            </FormField>
            <FormField label="App-specific password">
              <Input
                type="password"
                name="password"
                autoComplete="new-password"
                required
                placeholder="xxxx-xxxx-xxxx-xxxx"
                maxLength={19}
              />
            </FormField>
          </FormFields>
        </>
      ) : null}
    </>
  );
}

function ConnectedCalendarStatus({
  connection,
}: {
  connection: ConnectionSummary | null;
}) {
  return (
    <>
      {connection?.selected_calendar_url ? (
        <>
          <div>
            <h2 className="font-medium">{connection.calendar_name}</h2>
            <p className="text-sm text-muted-foreground">
              {connection.read_only
                ? "Read-only: changes come from Apple Calendar."
                : "Two-way sync: edit events in either app."}
            </p>
            <p className="mt-2 text-sm">
              {connection.last_synced_at
                ? `Last successful sync: ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" }).format(new Date(connection.last_synced_at))}`
                : "Ready to import your existing events."}
            </p>
          </div>
          {connection.last_error ? (
            <p role="status" className="text-sm text-destructive">
              {connection.last_error}
            </p>
          ) : null}
          <CalendarActionButton
            action={syncCalendarAction}
            label="Sync now"
            pendingLabel="Syncing with iCloud…"
            successLabel="Sync complete. Open the calendar to see your plans."
          />
          <Link href="/plan/calendar" className="text-sm underline">
            Open our calendar
          </Link>
          <p className="text-sm text-muted-foreground">
            Sync is on demand. New Household OS events stay local unless you
            choose to add them to iCloud. Repeating events and their individual
            changes stay together as one series.
          </p>
        </>
      ) : null}
    </>
  );
}

function CalendarPicker({
  connection,
  calendars,
  configured,
}: {
  connection: ConnectionSummary | null;
  calendars: AppleCalendar[];
  configured: boolean;
}) {
  return (
    <>
      {connection && !connection.selected_calendar_url && configured ? (
        <>
          <h2 className="font-medium">Choose your shared calendar</h2>
          {calendars.length ? (
            <FormFields
              action={selectCalendarAction}
              submitLabel="Use this calendar"
            >
              <FormField label="Calendar">
                <EchoedSelect
                  name="calendarUrl"
                  initialValue={calendars[0]?.url ?? ""}
                  items={calendars.map((calendar) => ({
                    value: calendar.url,
                    label: `${calendar.name}${calendar.readOnly ? " (read-only)" : ""}`,
                  }))}
                />
              </FormField>
            </FormFields>
          ) : (
            <p className="text-sm">
              No calendars are available yet. Check calendar sharing in Apple
              Calendar and reload this page.
            </p>
          )}
        </>
      ) : null}
    </>
  );
}
