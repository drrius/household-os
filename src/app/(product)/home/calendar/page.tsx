import { getConnectionSummary } from "@/lib/calendar/context";
import { listConnectedCalendars } from "@/lib/calendar/connection";
import { calendarEncryptionConfigured } from "@/lib/calendar/credentials";
import { calendarErrorMessage } from "@/lib/calendar/errors";
import { ConnectionScreen } from "@/ui/calendar/connection-screen";
export const maxDuration = 60;
export default async function CalendarConnectionPage() {
  const connection = await getConnectionSummary();
  const configured = calendarEncryptionConfigured();
  let calendars: Awaited<ReturnType<typeof listConnectedCalendars>> = [];
  let error;
  if (connection && !connection.selected_calendar_url && configured)
    try {
      calendars = await listConnectedCalendars();
    } catch (failure) {
      error = calendarErrorMessage(failure);
    }
  return (
    <ConnectionScreen
      connection={connection}
      calendars={calendars}
      configured={configured}
      error={error}
    />
  );
}
