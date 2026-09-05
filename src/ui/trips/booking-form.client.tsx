"use client";
import type { TripBooking } from "@/domain/projects/types";
import { bookingClockChoice, bookingLocalTime } from "@/domain/trips/clock";
import { formatCentimesField } from "@/domain/money/chf";
import type { FormAction } from "@/lib/forms/action-state";
import { FormFields } from "@/ui/forms/form-fields.client";
import { RecordField, RecordSelect } from "@/ui/projects/record-field.client";
import { useEditSnapshot } from "@/ui/projects/use-edit-snapshot.client";
import { BookingSection } from "./booking-section.client";
import { BookingTimes } from "./booking-times.client";
export const bookingKinds = [
  { value: "flight", label: "Flight" },
  { value: "stay", label: "Hotel or stay" },
  { value: "transport", label: "Train, car or transport" },
  { value: "activity", label: "Activity" },
  { value: "other", label: "Other" },
];
const statuses = [
  { value: "idea", label: "Considering" },
  { value: "booked", label: "Booked" },
  { value: "cancelled", label: "Cancelled" },
];
type Props = {
  id: string;
  projectId: string;
  booking?: TripBooking;
  action: FormAction;
  back?: string;
};
function initialValues(booking?: TripBooking) {
  const startZone = booking?.time_zone ?? "Europe/Zurich",
    endZone = booking?.end_time_zone ?? startZone;
  return {
    title: booking?.title ?? "",
    kind: booking?.kind ?? "flight",
    status: booking?.status ?? "idea",
    origin: booking?.origin ?? "",
    destination: booking?.destination ?? "",
    confirmation: booking?.confirmation ?? "",
    website: booking?.website ?? "",
    notes: booking?.notes ?? "",
    estimate:
      booking?.estimated_amount_cents != null
        ? formatCentimesField(booking.estimated_amount_cents)
        : "",
    starts_at: bookingLocalTime(booking?.starts_at ?? null, startZone).replace(
      /:00$/,
      "",
    ),
    ends_at: bookingLocalTime(booking?.ends_at ?? null, endZone).replace(
      /:00$/,
      "",
    ),
    time_zone: startZone,
    end_time_zone: endZone,
    start_clock: bookingClockChoice(booking?.starts_at ?? null, startZone),
    end_clock: bookingClockChoice(booking?.ends_at ?? null, endZone),
  };
}
export function BookingForm(props: Props) {
  return <BookingEditor key={props.booking?.id ?? "new"} {...props} />;
}
function BookingEditor(props: Props) {
  const { data, events } = useEditSnapshot(
    props,
    initialValues(props.booking),
    !props.booking,
  );
  return (
    <div {...events}>
      <BookingFields
        key={data.booking?.updated_at ?? "new"}
        {...data}
        action={props.action}
      />
    </div>
  );
}
function BookingFields({ id, projectId, booking, action, back }: Props) {
  const values = initialValues(booking);
  return (
    <FormFields
      action={action}
      submitLabel={booking ? "Save booking" : "Add booking"}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back ?? ""} />
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="updatedAt" value={booking?.updated_at ?? ""} />
      <RecordField
        name="title"
        label="Booking name"
        initial={values.title}
        maxLength={200}
      />
      <RecordSelect
        name="kind"
        label="Type"
        initial={values.kind}
        options={bookingKinds}
      />
      <RecordSelect
        name="status"
        label="Status"
        initial={values.status}
        options={statuses}
      />
      <BookingSection
        title="Dates, times and places"
        fields={[
          "starts_at",
          "ends_at",
          "time_zone",
          "end_time_zone",
          "origin",
          "destination",
        ]}
        initialOpen={Boolean(booking?.starts_at || booking?.ends_at)}
      >
        <BookingTimes values={values} />
        <RecordField
          name="origin"
          label="From / meeting point"
          initial={values.origin}
          maxLength={500}
          optional
        />
        <RecordField
          name="destination"
          label="To / address"
          initial={values.destination}
          maxLength={500}
          optional
        />
      </BookingSection>
      <BookingExtras booking={booking} values={values} />
      <RecordField
        name="notes"
        label="Notes"
        initial={values.notes}
        maxLength={8000}
        multiline
        optional
      />
    </FormFields>
  );
}

function BookingExtras({
  booking,
  values,
}: {
  booking?: TripBooking;
  values: ReturnType<typeof initialValues>;
}) {
  return (
    <BookingSection
      title="Confirmation and expected cost"
      fields={["confirmation", "website", "estimate"]}
      initialOpen={Boolean(
        booking?.confirmation ||
        booking?.website ||
        booking?.estimated_amount_cents != null,
      )}
    >
      <RecordField
        name="confirmation"
        label="Confirmation / flight number"
        initial={values.confirmation}
        maxLength={300}
        optional
      />
      <RecordField
        name="website"
        label="Booking link"
        type="url"
        initial={values.website}
        maxLength={2000}
        optional
      />
      <RecordField
        name="estimate"
        label="Expected cost (CHF)"
        initial={values.estimate}
        optional
        description="This is an estimate. It does not change who owes whom."
      />
    </BookingSection>
  );
}
