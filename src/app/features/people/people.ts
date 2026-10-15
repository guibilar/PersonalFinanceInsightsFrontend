import { InjectionToken } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BirthdayDto } from '../../core/models/outputs/people-output-dto';
import { isoDay } from '../../shared/utils/date-presets';
import { formatDay } from '../../shared/utils/format';
import { conflictDetail, validationDetail } from '../../shared/utils/problem-detail';
import { daysBetween } from '../tasks/tasks';

/** The limits of the People module (HestiaBackend, `Person`, `Interaction`, `GiftIdea`, and `Loan`). */
export const PEOPLE_LIMITS = {
  name: 200,
  nickname: 100,
  relationship: 50,
  email: 254,
  phone: 50,
  notes: 4000,
  groups: 20,
  group: 50,
  contactEveryDays: 3650,
  kind: 50,
  note: 4000,
  giftTitle: 200,
  giftNotes: 2000,
  occasion: 50,
  itemName: 200,
  loanNotes: 2000,
  amount: 9_999_999_999.99,
} as const;

/**
 * Today as `yyyy-MM-dd`: the browser's day. The pages use the day of the server (`date` of the summary) when they have
 * it. Tests give a fixed day.
 */
export const PEOPLE_TODAY = new InjectionToken<() => string>('PEOPLE_TODAY', {
  providedIn: 'root',
  factory: () => () => isoDay(new Date()),
});

/** The kinds of contact that the "Log contact" form offers. The API takes any text. */
export const CONTACT_KINDS = ['Call', 'Message', 'Coffee', 'Visit', 'Meal', 'Other'] as const;

/** The reminders that the form offers, in days. */
export const REMINDER_CHOICES: readonly { days: number; label: string }[] = [
  { days: 7, label: 'Every week' },
  { days: 14, label: 'Every 2 weeks' },
  { days: 30, label: 'Every month' },
  { days: 42, label: 'Every 6 weeks' },
  { days: 90, label: 'Every 3 months' },
  { days: 182, label: 'Every 6 months' },
  { days: 365, label: 'Every year' },
];

/** Up to two capital letters of a name: "Marco Silva" → "MS", "Ana" → "A". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** A group as the page shows it: the first letter in capitals ("gaming group" → "Gaming group"). */
export function groupLabel(group: string): string {
  return group.charAt(0).toUpperCase() + group.slice(1);
}

/** The colour pair of an avatar, from the name, so a person keeps the same colour. Six pairs. */
export function avatarTone(name: string): number {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(hash) % 6;
}

/** "today", "yesterday", "5 days ago", "3 weeks ago", "4 months ago", "2 years ago". */
export function agoText(day: string, today: string): string {
  const days = daysBetween(day, today);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/** "Last contact 6 weeks ago", or "No contact yet". */
export function lastContactText(lastContactOn: string | null, today: string): string {
  return lastContactOn ? `Last contact ${agoText(lastContactOn, today)}` : 'No contact yet';
}

/** A reminder in words: "Every 6 weeks", "Every 10 days", or "None". */
export function reminderText(days: number | null): string {
  if (!days) return 'None';
  const known = REMINDER_CHOICES.find((choice) => choice.days === days);
  if (known) return known.label;
  if (days % 7 === 0) return `Every ${days / 7} weeks`;
  return `Every ${days} days`;
}

/** A birthday as "Nov 2", or "Nov 2, 1990" with the year. */
export function birthdayText(birthday: BirthdayDto | null): string {
  if (!birthday) return '';
  const day = `2000-${String(birthday.month).padStart(2, '0')}-${String(birthday.day).padStart(2, '0')}`;
  const short = formatDay(day, { year: false });
  return birthday.year ? `${short}, ${birthday.year}` : short;
}

/** The days to a birthday in words: "Today", "Tomorrow", or "In 23 days". */
export function inDaysText(days: number): string {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/** The month of a day as three capitals ("NOV"), and the day number, for the date badge. */
export function dateBadge(day: string): { month: string; day: number } {
  const date = new Date(`${day.slice(0, 10)}T00:00:00`);
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: date.getDate(),
  };
}

/** Groups typed as "Family, gaming group": trimmed, lower case, without repeats. */
export function parseGroups(text: string): string[] {
  const groups: string[] = [];
  for (const part of text.split(',')) {
    const group = part.trim().replace(/\s+/g, ' ').toLowerCase();
    if (group && !groups.includes(group)) groups.push(group);
  }
  return groups;
}

/** An id from the address, when it is a GUID. Another value is ignored: the API would refuse it. */
export function guidOrNull(value: string | null | undefined): string | null {
  const id = value?.trim() ?? '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

/**
 * What to say when the API refuses a change: the read-only account (403), a person or record that is gone (404), the
 * server's reason for a conflict (409) or for invalid input (400), finance down for a link (502), or the fallback.
 */
export function peopleError(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 403) return 'This account can only read the people.';
    if (error.status === 404) return 'This person or record does not exist any more.';
    if (error.status === 409) return conflictDetail(error, fallback);
    if (error.status === 502) return 'The server could not check with Money. Try again later.';
  }
  return validationDetail(error, fallback);
}
