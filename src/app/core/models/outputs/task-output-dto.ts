/**
 * The Tasks module of Hestia.Api (`/api/tasks`). Written by hand from the contracts in HestiaBackend
 * (`Hestia.Modules.Tasks.Contracts/TaskDtos.cs`).
 */

/** A repeated task stays `Open`: "done" moves its due date. */
export type TaskStatus = 'Open' | 'Done';

export type RepeatUnit = 'Days' | 'Weeks' | 'Months' | 'Years';

/** All units, in the order the form shows them. */
export const REPEAT_UNITS: readonly RepeatUnit[] = ['Days', 'Weeks', 'Months', 'Years'];

/**
 * How the next due date of a repeated task is found. `FromDueDate`: a fixed schedule from the due date (the 1st of
 * each month). `FromCompletion`: from the day the task was done ("water the plants 4 days after the last time").
 */
export type RepeatMode = 'FromDueDate' | 'FromCompletion';

export interface TaskRepeatDto {
  /** 1 or more. */
  every: number;
  unit: RepeatUnit;
  mode: RepeatMode;
}

/** The link kind of a document. */
export const DOCUMENT_LINK = 'Documents.Document';
/** The link kind of a finance transaction. */
export const TRANSACTION_LINK = 'Money.Transaction';

/** A link from a task to something in another module, for example a document. */
export interface TaskLinkDto {
  id: string;
  /** `Documents.Document` or `Money.Transaction`. */
  kind: string;
  targetId: string;
  createdAt: string;
}

/** One time that a task was done. */
export interface TaskCompletionDto {
  id: string;
  doneAt: string;
  /** The due date that was done (`yyyy-MM-dd`), or null for a task without a due date. */
  dueOn: string | null;
}

/** A task in a list. */
export interface TaskSummaryDto {
  id: string;
  title: string;
  notes: string | null;
  /** A day, `yyyy-MM-dd`, or null for "some day". A repeated task always has one. */
  dueOn: string | null;
  /** In lower case. */
  tags: string[];
  status: TaskStatus;
  /** When a task without a repeat was done. */
  doneAt: string | null;
  repeat: TaskRepeatDto | null;
  /** The manual order inside a day (lower first). */
  sortOrder: number | null;
  /** When the task was last done, also for a repeated task. */
  lastDoneAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Oldest first. */
  links: TaskLinkDto[];
}

/** One task, with its last 10 completions (newest first). */
export interface TaskDto extends TaskSummaryDto {
  completions: TaskCompletionDto[];
}

/** The counts of open tasks, for the badges (`GET /api/tasks/summary`). */
export interface TaskCountsDto {
  /** Today in the time zone of the server (`Tasks:TimeZone`), `yyyy-MM-dd`. */
  date: string;
  dueToday: number;
  overdue: number;
  /** Due in the next 7 days after today. */
  upcoming: number;
}
