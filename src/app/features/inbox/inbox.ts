import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, map, switchMap } from 'rxjs';
import { JournalRepository } from '../../core/api/journal-repository';
import { TaskRepository } from '../../core/api/task-repository';
import { validationDetail } from '../../shared/utils/problem-detail';

/** The limits of the Inbox module (HestiaBackend, `InboxLimits`). */
export const INBOX_LIMITS = { text: 4000 } as const;

/** Where a note can go: the Inbox (to sort later), a task, or today's journal entry. */
export type NoteTarget = 'Inbox' | 'Task' | 'Journal';

/** The longest task title (HestiaBackend, Tasks module). */
const TASK_TITLE_LENGTH = 200;

/** A note as a task: the first line is the title (at most 200 characters), the rest the notes. */
export function taskFromNote(text: string): { title: string; notes: string | null } {
  const lines = text.trim().split('\n');
  let title = lines[0].trim();
  let rest = lines.slice(1).join('\n').trim();
  if (title.length > TASK_TITLE_LENGTH) {
    rest = [title.slice(TASK_TITLE_LENGTH - 1), rest].filter(Boolean).join('\n');
    title = `${title.slice(0, TASK_TITLE_LENGTH - 1)}…`;
  }
  return { title, notes: rest || null };
}

/** Today's journal text with the note added as a new paragraph. */
export function journalWithNote(existing: string | null | undefined, note: string): string {
  const text = note.trim();
  return existing?.trim() ? `${existing.trim()}\n\n${text}` : text;
}

/** What to say when a change fails. */
export function inboxError(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 403) return 'This account can only read.';
    if (error.status === 404) return 'This note does not exist any more.';
  }
  return validationDetail(error, fallback);
}

/**
 * Puts a note into another module (T18): the Inbox module has no write contracts with the others, so the app adds the
 * task, or writes today's journal entry, itself.
 */
@Injectable({ providedIn: 'root' })
export class NoteSender {
  private readonly tasks = inject(TaskRepository);
  private readonly journal = inject(JournalRepository);

  /** A new task from the note. */
  toTask(text: string): Observable<void> {
    const { title, notes } = taskFromNote(text);
    return this.tasks
      .create({ title, notes, dueOn: null, tags: [], repeat: null })
      .pipe(map(() => undefined));
  }

  /** The note at the end of today's journal entry (a new entry when today has none). */
  toJournal(text: string): Observable<void> {
    return this.journal.summary().pipe(
      switchMap((summary) =>
        this.journal.save(summary.date, journalWithNote(summary.today?.text, text)),
      ),
      map(() => undefined),
    );
  }
}
