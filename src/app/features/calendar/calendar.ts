import { HttpErrorResponse } from '@angular/common/http';
import { IconName } from '../../shared/ui/icon/icon.component';
import { validationDetail } from '../../shared/utils/problem-detail';
import { CalendarItem } from '../../core/models/outputs/calendar-output-dto';

/** The limits of the Calendar module (HestiaBackend, `CalendarLimits`). */
export const CALENDAR_LIMITS = {
  title: 200,
  location: 300,
  notes: 4000,
  /** The biggest `.ics` file that the page sends (the server takes 5 million characters). */
  icsBytes: 5_000_000,
} as const;

/** A day as `yyyy-MM-dd` in the browser's zone. */
export function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The day `days` after `day` (both `yyyy-MM-dd`). */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + days);
  return isoDay(date);
}

/** The first day of the month of `day`. */
export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

/** The first day of the month `months` after the month of `day`. */
export function addMonths(day: string, months: number): string {
  const date = new Date(`${monthStart(day)}T12:00:00`);
  date.setMonth(date.getMonth() + months);
  return isoDay(date);
}

/** "October 2026". */
export function monthTitle(day: string): string {
  return new Date(`${monthStart(day)}T12:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * The weeks of a month view: whole weeks from the Sunday on or before the 1st to the Saturday on or after the last day
 * (5 or 6 weeks).
 */
export function monthWeeks(day: string): string[][] {
  const first = new Date(`${monthStart(day)}T12:00:00`);
  const start = addDays(isoDay(first), -first.getDay());
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12);
  const end = addDays(isoDay(last), 6 - last.getDay());
  const weeks: string[][] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
  }
  return weeks;
}

/** The items that touch a day, in the order of the server (whole days first, then by time). */
export function itemsOn(items: readonly CalendarItem[], day: string): CalendarItem[] {
  return items.filter((item) => item.startDate <= day && item.endDate >= day);
}

/** "9:00 AM", in the browser's zone. */
export function timeOf(moment: string): string {
  return new Date(moment).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** "All day", "9:00 AM", or "9:00 AM – 10:30 AM". */
export function whenText(item: CalendarItem): string {
  if (item.allDay || !item.startsAt) {
    return item.startDate === item.endDate
      ? 'All day'
      : `All day · until ${shortDay(item.endDate)}`;
  }
  if (!item.endsAt || item.endsAt === item.startsAt) return timeOf(item.startsAt);
  return `${timeOf(item.startsAt)} – ${timeOf(item.endsAt)}`;
}

/** "Mon, Oct 20". */
export function shortDay(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** "Today", "Tomorrow", or "Tuesday, October 20". */
export function dayHeading(day: string, today: string): string {
  if (day === today) return 'Today';
  if (day === addDays(today, 1)) return 'Tomorrow';
  return new Date(`${day}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(day.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
  });
}

/** The icon of an item, by its kind. */
export function itemIcon(item: CalendarItem): IconName {
  switch (item.kind) {
    case 'task-due':
      return 'list-checks';
    case 'birthday':
      return 'users';
    case 'reach-out':
      return 'user';
    case 'loan-due':
      return 'arrow-right';
    case 'document-expires':
      return 'file-text';
    case 'warranty-ends':
      return 'house';
    default:
      return 'calendar';
  }
}

/** The colour of a module (styles.scss, data-accent): `calendar`, `tasks`, `people`, … */
export function accentOf(item: CalendarItem): string {
  return item.module.toLowerCase();
}

/** A repeat that the dialog offers. `rule` is the RRULE without UNTIL. */
export interface RepeatPreset {
  readonly label: string;
  readonly rule: string;
}

export const REPEAT_PRESETS: readonly RepeatPreset[] = [
  { label: 'Does not repeat', rule: '' },
  { label: 'Every day', rule: 'FREQ=DAILY' },
  { label: 'Every week', rule: 'FREQ=WEEKLY' },
  { label: 'Every 2 weeks', rule: 'FREQ=WEEKLY;INTERVAL=2' },
  { label: 'Every month', rule: 'FREQ=MONTHLY' },
  { label: 'Every year', rule: 'FREQ=YEARLY' },
];

/** The browser's time zone, such as `America/Toronto`. */
function browserZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** The wall clock of `instant` in `timeZone`, as if it were UTC (ms): the zone's offset is the difference. */
function wallClock(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(instant));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
}

/** The day of an UNTIL in `timeZone`: a day ("20261231") as it is, a UTC moment ("20270101T045959Z") on its local day. */
function untilDay(value: string, timeZone: string): string | null {
  const moment = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/i.exec(value);
  if (moment) {
    const [y, mo, d, h, mi, s] = moment.slice(1).map(Number);
    return new Date(wallClock(Date.UTC(y, mo - 1, d, h, mi, s), timeZone))
      .toISOString()
      .slice(0, 10);
  }
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** The RRULE without its UNTIL and COUNT, and the UNTIL day (`yyyy-MM-dd`) in `timeZone`, if any. */
export function splitRepeat(
  repeat: string | null,
  timeZone = browserZone(),
): { rule: string; until: string | null } {
  if (!repeat) return { rule: '', until: null };
  let until: string | null = null;
  const parts = repeat.split(';').filter((part) => {
    const [key, value] = part.split('=');
    if (key.toUpperCase() === 'UNTIL') {
      until = untilDay(value ?? '', timeZone);
      return false;
    }
    return true;
  });
  return { rule: parts.join(';'), until };
}

/**
 * The RRULE of a preset and an end day: an all-day event ends on the day; one with a time at the end of the day in
 * `timeZone`, written in UTC as RFC 5545 asks. The end of the UTC day would drop the last evening in the Americas (8 PM
 * in Toronto is after midnight UTC).
 */
export function joinRepeat(
  rule: string,
  until: string | null,
  allDay: boolean,
  timeZone = browserZone(),
): string | null {
  if (!rule) return null;
  if (!until) return rule;
  if (allDay) return `${rule};UNTIL=${until.replaceAll('-', '')}`;
  const [y, m, d] = until.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, 23, 59, 59);
  // The offset at the guess, then at the moment it gives: right on either side of a change of the clocks.
  let end = wall - (wallClock(wall, timeZone) - wall);
  end = wall - (wallClock(end, timeZone) - end);
  const utc = new Date(end).toISOString().replace(/[-:]/g, '').slice(0, 15);
  return `${rule};UNTIL=${utc}Z`;
}

/** "Every week", or "Repeats (custom)" for a rule that the presets do not have. */
export function repeatText(repeat: string | null, timeZone = browserZone()): string | null {
  if (!repeat) return null;
  const { rule, until } = splitRepeat(repeat, timeZone);
  const preset = REPEAT_PRESETS.find((p) => p.rule === rule && p.rule !== '');
  const base = preset?.label ?? 'Repeats (custom)';
  return until ? `${base} until ${shortDay(until)}` : base;
}

/** What to say when the API refuses a change. */
export function calendarError(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 403) return 'This account can only read the calendar.';
    if (error.status === 404) return 'This event does not exist any more.';
  }
  return validationDetail(error, fallback);
}
