import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TaskRepository } from '../../core/api/task-repository';
import { DataChangesService } from '../../core/data/data-changes.service';
import { TaskDto, TaskSummaryDto } from '../../core/models/outputs/task-output-dto';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatDay } from '../../shared/utils/format';
import { taskError } from './tasks';

/**
 * "Done" and "Undo" for a task, the same on every page: the Tasks page, a task, and the tasks of a document. After a
 * change, it says so with a toast that offers "Undo", and tells the other pages (`DataChangesService`), so Today and
 * the badge load again.
 */
@Injectable({ providedIn: 'root' })
export class TaskDoneService {
  private readonly repository = inject(TaskRepository);
  private readonly dataChanges = inject(DataChangesService);
  private readonly toasts = inject(ToastService);

  private readonly pending = signal<ReadonlySet<string>>(new Set());
  /** The tasks with a change in progress: their checkboxes wait. */
  readonly busy = this.pending.asReadonly();

  /** Marks an open task done, or undoes the last "done" of a done task. */
  toggle(task: TaskSummaryDto): void {
    if (task.status === 'Done') this.undo(task);
    else this.done(task);
  }

  done(task: TaskSummaryDto): void {
    this.run(task, this.repository.done(task.id), 'Could not mark the task done.', (changed) => {
      const message = changed.repeat
        ? `Done: “${changed.title}”. Next: ${changed.dueOn ? formatDay(changed.dueOn) : 'today'}.`
        : `Done: “${changed.title}”.`;
      this.toasts.successWithAction(message, { label: 'Undo', run: () => this.undo(changed) });
    });
  }

  undo(task: TaskSummaryDto): void {
    this.run(task, this.repository.undo(task.id), 'Could not undo the done.', (changed) =>
      this.toasts.success(`“${changed.title}” is open again.`),
    );
  }

  private run(
    task: TaskSummaryDto,
    request: ReturnType<TaskRepository['done']>,
    fallback: string,
    after: (changed: TaskDto) => void,
  ): void {
    if (this.pending().has(task.id)) return;
    this.setPending(task.id, true);
    request.subscribe({
      next: (changed) => {
        this.setPending(task.id, false);
        this.dataChanges.changed();
        after(changed);
      },
      error: (error: unknown) => {
        this.setPending(task.id, false);
        // 409: another tab or device changed the task first. Show what the server has now.
        if (error instanceof HttpErrorResponse && error.status === 409) this.dataChanges.changed();
        this.toasts.error(taskError(error, fallback));
      },
    });
  }

  private setPending(id: string, on: boolean): void {
    this.pending.update((ids) => {
      const next = new Set(ids);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
