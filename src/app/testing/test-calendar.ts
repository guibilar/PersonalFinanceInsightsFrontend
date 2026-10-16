import {
  CalendarDto,
  CalendarEventDto,
  CalendarImportResultDto,
  CalendarItem,
} from '../core/models/outputs/calendar-output-dto';

/** The day of the Calendar tests: Friday, October 16th, 2026. */
export const CALENDAR_TODAY = '2026-10-16';

export function testCalendarItem(overrides: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id: 'calendar.event.ev1',
    module: 'Calendar',
    kind: 'event',
    title: 'Dentist',
    text: 'Main St 4',
    allDay: false,
    startDate: '2026-10-20',
    endDate: '2026-10-20',
    startsAt: '2026-10-20T15:00:00Z',
    endsAt: '2026-10-20T16:00:00Z',
    link: '/calendar?event=ev1',
    eventId: 'ev1',
    recurring: false,
    done: null,
    ...overrides,
  };
}

export function testCalendar(
  items: CalendarItem[],
  overrides: Partial<CalendarDto> = {},
): CalendarDto {
  return {
    today: CALENDAR_TODAY,
    from: '2026-09-27',
    to: '2026-11-07',
    timeZone: 'America/Edmonton',
    items,
    modules: ['Calendar', 'Documents', 'Home', 'People', 'Tasks'].map((module) => ({
      module,
      status: 'Complete' as const,
    })),
    ...overrides,
  };
}

export function testCalendarEvent(overrides: Partial<CalendarEventDto> = {}): CalendarEventDto {
  return {
    id: 'ev1',
    title: 'Dentist',
    allDay: false,
    startDate: null,
    endDate: null,
    startsAt: '2026-10-20T15:00:00Z',
    endsAt: '2026-10-20T16:00:00Z',
    timeZone: 'America/Edmonton',
    location: 'Main St 4',
    notes: null,
    repeat: null,
    skippedDates: [],
    source: 'Manual',
    uid: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

export function testImportResult(
  overrides: Partial<CalendarImportResultDto> = {},
): CalendarImportResultDto {
  return {
    dryRun: true,
    added: 1,
    updated: 0,
    unchanged: 1,
    deleted: 0,
    skipped: 0,
    events: [
      {
        action: 'Add',
        title: 'Yoga',
        allDay: false,
        startDate: null,
        startsAt: '2026-10-21T00:00:00Z',
        repeat: 'FREQ=WEEKLY',
        eventId: null,
        reason: null,
      },
      {
        action: 'Same',
        title: 'Long weekend',
        allDay: true,
        startDate: '2026-10-30',
        startsAt: null,
        repeat: null,
        eventId: 'ev2',
        reason: null,
      },
    ],
    ...overrides,
  };
}
