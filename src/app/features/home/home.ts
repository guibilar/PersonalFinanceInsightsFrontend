import { InjectionToken } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ItemTaskDto } from '../../core/models/outputs/home-output-dto';
import { RepeatUnit } from '../../core/models/outputs/task-output-dto';
import { isoDay } from '../../shared/utils/date-presets';
import { formatDay } from '../../shared/utils/format';
import { conflictDetail, validationDetail } from '../../shared/utils/problem-detail';
import { daysBetween, repeatText } from '../tasks/tasks';

/** The limits of the Home module (HestiaBackend, `Room`, `Item` and `ItemDetails`). */
export const HOME_LIMITS = {
  room: 100,
  name: 200,
  category: 50,
  brand: 100,
  model: 100,
  serialNumber: 100,
  notes: 4000,
  quantity: 100_000,
  amount: 9_999_999_999.99,
  tags: 20,
  tag: 50,
} as const;

/** A warranty that ends in this many days or fewer "ends soon" (`Home:WarrantySoonDays` on the server). */
export const WARRANTY_SOON_DAYS = 30;

/**
 * Today as `yyyy-MM-dd`, for the warranty states and the days left: the browser's day. The Home page uses the day of
 * the server (`date` of the summary) when it has it. Tests give a fixed day.
 */
export const HOME_TODAY = new InjectionToken<() => string>('HOME_TODAY', {
  providedIn: 'root',
  factory: () => () => isoDay(new Date()),
});

/** The largest page that the API gives (`PagingExtensions.MaxPageSize`). */
export const MAX_PAGE_SIZE = 100;

/** The address part of the items without a room: `/home/rooms/none`, and `room=none` in the API. */
export const NO_ROOM = 'none';

/** What the page calls the items without a room. */
export const NO_ROOM_NAME = 'No room';

/** The state of a warranty: `active` (more than 30 days), `ending` (today to 30 days), or `ended`. */
export type WarrantyState = 'active' | 'ending' | 'ended';

export interface WarrantyView {
  state: WarrantyState;
  /** "Under warranty until Nov 9, 2027", "Ends in 12 days", "Ends today", or "Ended". */
  text: string;
}

/** The warranty of an item, in words; null for an item without a warranty. `today` is `yyyy-MM-dd`. */
export function warrantyOf(warrantyUntil: string | null, today: string): WarrantyView | null {
  if (!warrantyUntil) return null;
  const days = daysBetween(today, warrantyUntil);
  if (days < 0) return { state: 'ended', text: `Ended ${formatDay(warrantyUntil)}` };
  if (days === 0) return { state: 'ending', text: 'Ends today' };
  if (days <= WARRANTY_SOON_DAYS) {
    return { state: 'ending', text: `Ends in ${days} ${days === 1 ? 'day' : 'days'}` };
  }
  return { state: 'active', text: `Under warranty until ${formatDay(warrantyUntil)}` };
}

/** The badge class of a warranty state. */
export function warrantyBadge(state: WarrantyState): string {
  return state === 'ended'
    ? 'text-bg-secondary'
    : state === 'ending'
      ? 'text-bg-warning'
      : 'text-bg-success';
}

/** The days to a due date, short: "Today", "1 day", "22 days", or "3 days late". Empty without a date. */
export function daysLeftText(dueOn: string | null, today: string): string {
  if (!dueOn) return '';
  const days = daysBetween(today, dueOn);
  if (days === 0) return 'Today';
  if (days < 0) return `${-days} ${days === -1 ? 'day' : 'days'} late`;
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** The repeat of a maintenance task of an item: "Every 3 months", or "Once" for a task without a repeat. */
export function maintenanceRule(task: ItemTaskDto): string {
  if (!task.repeatEvery || !task.repeatUnit) return 'Once';
  return repeatText({
    every: task.repeatEvery,
    unit: task.repeatUnit as RepeatUnit,
    mode: 'FromDueDate',
  });
}

/** An id from the address, when it is a GUID. Another value is ignored: the API would refuse it. */
export function guidOrNull(value: string | null | undefined): string | null {
  const id = value?.trim() ?? '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

/** A day from the address, when it has the form `yyyy-MM-dd`. */
export function dayOrNull(value: string | null | undefined): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? value! : null;
}

/** An amount from the address, when it is a number from 0 to the limit (with cents). */
export function amountOrNull(value: string | null | undefined): number | null {
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const amount = Number(value);
  return amount <= HOME_LIMITS.amount ? amount : null;
}

/**
 * What to say when the API refuses a change: the read-only account (403), an item or room that is gone (404), the
 * server's reason for a conflict (409) or for invalid input (400), finance down for a link (502), or the fallback.
 */
export function homeError(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 403) return 'This account can only read the home inventory.';
    if (error.status === 404) return 'This item or room does not exist any more.';
    if (error.status === 409) return conflictDetail(error, fallback);
    if (error.status === 502) return 'The server could not check with Money. Try again later.';
  }
  return validationDetail(error, fallback);
}
