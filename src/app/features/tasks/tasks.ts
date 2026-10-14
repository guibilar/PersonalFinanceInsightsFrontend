import { HttpErrorResponse } from '@angular/common/http';
import { isoDay } from '../../shared/utils/date-presets';
import { formatDay } from '../../shared/utils/format';
import { conflictDetail, validationDetail } from '../../shared/utils/problem-detail';
import {
  DOCUMENT_LINK,
  RepeatMode,
  RepeatUnit,
  TRANSACTION_LINK,
  TaskRepeatDto,
  TaskSummaryDto,
} from '../../core/models/outputs/task-output-dto';
import { TaskDueFilter } from '../../core/models/inputs/task-input-dto';

/** The limits of the Tasks module (HestiaBackend, `TaskItem` and `TaskDetails`). */
export const TASK_LIMITS = {
  title: 200,
  notes: 4000,
  tags: 20,
  tag: 50,
  every: 1000,
} as const;

/** The days after today that "Upcoming" shows (`Tasks:UpcomingDays` on the server). */
export const UPCOMING_DAYS = 7;

/** The largest page that the API gives (`PagingExtensions.MaxPageSize`). */
export const MAX_PAGE_SIZE = 100;

/** How many done tasks the "Done" section shows. */
export const DONE_SHOWN = 20;

/** The `due` values that the Tasks page takes from the address (`/tasks?due=overdue`). */
export const DUE_FILTERS: readonly TaskDueFilter[] = ['overdue', 'today', 'upcoming', 'none'];

/** What the page says when the address has a `due` filter: "Only the overdue tasks". */
export const DUE_FILTER_LABELS: Record<TaskDueFilter, string> = {
  overdue: 'overdue tasks',
  today: 'tasks due today',
  upcoming: 'tasks due in the next 7 days',
  none: 'tasks without a date',
};

/** A day (`yyyy-MM-dd`) plus some days (or minus, with a negative count). */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day.slice(0, 10)}T00:00:00`);
  date.setDate(date.getDate() + days);
  return isoDay(date);
}

/** Whole days from one day to another (`yyyy-MM-dd`): positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  const start = new Date(`${from.slice(0, 10)}T00:00:00`);
  const end = new Date(`${to.slice(0, 10)}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/** The open tasks of the Tasks page, in sections. Each list keeps the server order (due date first). */
export interface TaskSections {
  /** Due before today. Repeated tasks too: they need a "done". */
  overdue: TaskSummaryDto[];
  /** Due today. Repeated tasks too. */
  today: TaskSummaryDto[];
  /** Due in the next 7 days, without the repeated tasks (they are under "Recurring"). */
  upcoming: TaskSummaryDto[];
  /** Due later, or without a date, without the repeated tasks. */
  later: TaskSummaryDto[];
  /** All repeated tasks, by their next date. */
  recurring: TaskSummaryDto[];
}

/** Puts open tasks in their sections. `today` is a day (`yyyy-MM-dd`) in the server's time zone. */
export function groupTasks(tasks: readonly TaskSummaryDto[], today: string): TaskSections {
  const lastUpcoming = addDays(today, UPCOMING_DAYS);
  const sections: TaskSections = { overdue: [], today: [], upcoming: [], later: [], recurring: [] };
  for (const task of tasks) {
    if (task.status !== 'Open') continue;
    const due = task.dueOn?.slice(0, 10) ?? null;
    if (task.repeat) sections.recurring.push(task);
    if (due !== null && due < today) sections.overdue.push(task);
    else if (due === today) sections.today.push(task);
    else if (task.repeat) continue;
    else if (due !== null && due <= lastUpcoming) sections.upcoming.push(task);
    else sections.later.push(task);
  }
  return sections;
}

const UNIT_NAMES: Record<RepeatUnit, [string, string]> = {
  Days: ['day', 'days'],
  Weeks: ['week', 'weeks'],
  Months: ['month', 'months'],
  Years: ['year', 'years'],
};

/** The unit as a word: "day" or "days". */
export function unitName(unit: RepeatUnit, every: number): string {
  const [one, many] = UNIT_NAMES[unit];
  return every === 1 ? one : many;
}

/** "Every day", "Every 4 days", "Every 12 months". */
export function repeatText(repeat: TaskRepeatDto): string {
  return repeat.every === 1
    ? `Every ${unitName(repeat.unit, 1)}`
    : `Every ${repeat.every} ${unitName(repeat.unit, repeat.every)}`;
}

/** The repeat modes in plain words, for the form and the rows. */
export const REPEAT_MODES: readonly { mode: RepeatMode; label: string; help: string }[] = [
  {
    mode: 'FromCompletion',
    label: 'After each done',
    help: 'The next date counts from the day you mark it done. For example: water the plants.',
  },
  {
    mode: 'FromDueDate',
    label: 'On a fixed schedule',
    help: 'The next date follows the schedule, also when you are late. For example: rent on the 1st.',
  },
];

/** "after each done" or "on a fixed schedule". */
export function repeatModeText(mode: RepeatMode): string {
  return mode === 'FromCompletion' ? 'after each done' : 'on a fixed schedule';
}

/** "Every 4 days, after each done". */
export function repeatRule(repeat: TaskRepeatDto): string {
  return `${repeatText(repeat)}, ${repeatModeText(repeat.mode)}`;
}

/**
 * When a task is due, in short words for a row: "3 days late", "Today", "Tomorrow", "Thu, Oct 16" (this week), or
 * "Nov 3, 2026". Empty for a task without a date.
 */
export function dueText(dueOn: string | null, today: string): string {
  if (!dueOn) return '';
  const days = daysBetween(today, dueOn);
  if (days < 0) {
    const late = -days;
    return `${formatDay(dueOn, { year: false })} · ${late} ${late === 1 ? 'day' : 'days'} late`;
  }
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= UPCOMING_DAYS) {
    return new Date(`${dueOn.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }
  return formatDay(dueOn);
}

/** The modules that a task links to, as short labels for a row: "Documents", "Money". */
export function linkLabels(task: TaskSummaryDto): string[] {
  const labels = new Set<string>();
  for (const link of task.links) {
    if (link.kind === DOCUMENT_LINK) labels.add('Documents');
    else if (link.kind === TRANSACTION_LINK) labels.add('Money');
    else labels.add(link.kind.split('.')[0]);
  }
  return [...labels];
}

/** Tags typed as "home, garden": trimmed, without empties and repeats, in lower case (as the API keeps them). */
export function parseTags(text: string): string[] {
  const tags = text
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag !== '');
  return [...new Set(tags)];
}

/**
 * The due date of a "renew" task for a document: 14 days before it expires, but not before today (a task that is
 * overdue at once helps nobody).
 */
export function renewDueOn(expiresOn: string, today: string): string {
  const due = addDays(expiresOn, -14);
  return due < today ? today : due;
}

/**
 * What to say when the API refuses a change: the read-only account (403), a task that is gone (404), the server's
 * reason for a conflict (409) or for invalid input (400), finance down for a link (502), or the fallback.
 */
export function taskError(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 403) return 'This account can only read tasks.';
    if (error.status === 404) return 'This task does not exist any more.';
    if (error.status === 409) return conflictDetail(error, fallback);
    if (error.status === 502) return 'The server could not check with Money. Try again later.';
  }
  return validationDetail(error, fallback);
}
