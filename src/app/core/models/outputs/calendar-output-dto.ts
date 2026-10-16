/** How complete a module's items are in one Calendar answer. */
export type CalendarModuleStatus = 'Complete' | 'Partial' | 'Failed';

/**
 * One thing on the Calendar (Hestia.Api, T103): an event of the Calendar module, or a dated thing of another module (a
 * task due, a birthday). Days are `yyyy-MM-dd`; times are ISO moments.
 */
export interface CalendarItem {
  /** Stable for the same thing and day; a repeated event adds the day of the occurrence. */
  id: string;
  /** `Calendar`, `Tasks`, `People`, `Documents`, or `Home`. */
  module: string;
  /** `event`, `task-due`, `birthday`, `reach-out`, `loan-due`, `document-expires`, `warranty-ends`. */
  kind: string;
  title: string;
  /** A second line (the place, "Turns 40"), or null. */
  text: string | null;
  allDay: boolean;
  startDate: string;
  /** The last day (included). */
  endDate: string;
  startsAt: string | null;
  endsAt: string | null;
  /** The web route of the thing, for example `/tasks/<id>` or `/calendar?event=<id>`. */
  link: string | null;
  /** For an event of the Calendar module: its id. */
  eventId?: string | null;
  recurring: boolean;
  /** For a task: false while it is open. */
  done?: boolean | null;
}

export interface CalendarModuleDto {
  module: string;
  status: CalendarModuleStatus;
}

/** `GET /api/calendar`: the items from `from` to `to`, by day, the whole-day ones first, then by time. */
export interface CalendarDto {
  today: string;
  from: string;
  to: string;
  /** The host's IANA time zone. */
  timeZone: string;
  items: CalendarItem[];
  modules: CalendarModuleDto[];
}

export type CalendarEventSource = 'Manual' | 'Import';

/** An event of the Calendar module. */
export interface CalendarEventDto {
  id: string;
  title: string;
  allDay: boolean;
  startDate: string | null;
  endDate: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timeZone: string;
  location: string | null;
  notes: string | null;
  /** An iCalendar RRULE, for example `FREQ=WEEKLY;BYDAY=TU`, or null. */
  repeat: string | null;
  skippedDates: string[];
  source: CalendarEventSource;
  uid: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CalendarImportAction = 'Add' | 'Update' | 'Same' | 'Delete' | 'Skip';

/** One event of an imported `.ics` file. */
export interface CalendarImportItemDto {
  action: CalendarImportAction;
  title: string;
  allDay: boolean;
  startDate: string | null;
  startsAt: string | null;
  repeat: string | null;
  eventId: string | null;
  reason: string | null;
}

export interface CalendarImportResultDto {
  dryRun: boolean;
  added: number;
  updated: number;
  unchanged: number;
  deleted: number;
  skipped: number;
  events: CalendarImportItemDto[];
}
