/**
 * A new event, or the new details of one (all values replace the old ones). All day: `startDate` (and `endDate`); with a
 * time: `startsAt` (and `endsAt`, default one hour later).
 */
export interface CalendarEventRequest {
  title: string;
  allDay: boolean;
  startDate?: string | null;
  endDate?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  timeZone?: string | null;
  location?: string | null;
  notes?: string | null;
  /** An iCalendar RRULE, or null for no repeat. */
  repeat?: string | null;
}
