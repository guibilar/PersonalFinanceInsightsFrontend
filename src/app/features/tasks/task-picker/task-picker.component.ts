import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { TaskRepository } from '../../../core/api/task-repository';
import { TaskSummaryDto } from '../../../core/models/outputs/task-output-dto';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { formatDay } from '../../../shared/utils/format';
import { keptValueOf } from '../../../shared/utils/resource-value';

/** How many tasks the picker lists. */
export const TASK_PICKER_PAGE_SIZE = 10;

/**
 * "Link to a task" (T94): the open tasks, or the matches of a search (title, notes, tags). Picking one emits it; the
 * parent makes the link.
 */
@Component({
  selector: 'app-task-picker',
  imports: [ReactiveFormsModule, ErrorStateComponent, ModalComponent, SkeletonComponent],
  template: `
    <app-modal title="Link to a task" (closed)="closed.emit()">
      <label for="task-picker-search" class="form-label">Search tasks</label>
      <input
        type="search"
        id="task-picker-search"
        class="form-control mb-3"
        placeholder="Titles, notes, tags"
        autocomplete="off"
        [formControl]="search"
      />
      @if (tasks.error()) {
        <app-error-state message="Could not load the tasks." (retry)="tasks.reload()" />
      } @else if (!list()) {
        <app-skeleton [lines]="5" height="2.5rem" />
      } @else if (list()!.length === 0) {
        <p class="text-body-secondary text-center py-4 mb-0">
          {{ term() ? 'No task matches “' + term() + '”.' : 'No open tasks.' }}
        </p>
      } @else {
        <ul class="list-group" data-testid="picker-tasks">
          @for (task of list(); track task.id) {
            <li class="list-group-item d-flex align-items-center gap-3">
              <span class="flex-grow-1 min-w-0">
                <span class="d-block text-truncate fw-medium">{{ task.title }}</span>
                <span class="d-block small text-body-secondary">{{ detail(task) }}</span>
              </span>
              <button
                type="button"
                class="btn btn-sm btn-outline-primary"
                [disabled]="busy() || linkedIds().includes(task.id)"
                [attr.aria-label]="'Link ' + task.title"
                (click)="picked.emit(task)"
              >
                {{ linkedIds().includes(task.id) ? 'Linked' : 'Link' }}
              </button>
            </li>
          }
        </ul>
      }
    </app-modal>
  `,
  styles: `
    .min-w-0 {
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskPickerComponent {
  private readonly repository = inject(TaskRepository);

  /** Tasks that are linked already: shown, but not linked twice. */
  readonly linkedIds = input<string[]>([]);
  /** A link is being made. */
  readonly busy = input(false);
  readonly picked = output<TaskSummaryDto>();
  readonly closed = output<void>();

  readonly search = new FormControl('', { nonNullable: true });
  readonly term = signal('');

  readonly tasks = rxResource({
    params: () => ({ q: this.term() }),
    stream: ({ params }) =>
      this.repository
        .list({ status: 'Open', q: params.q || null, page: 1, pageSize: TASK_PICKER_PAGE_SIZE })
        .pipe(map((page) => page.items)),
  });
  readonly list = keptValueOf(this.tasks);

  constructor() {
    this.search.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((term) => this.term.set(term));
  }

  /** "Due Oct 16, 2026", or "No due day". */
  detail(task: TaskSummaryDto): string {
    return task.dueOn ? `Due ${formatDay(task.dueOn)}` : 'No due day';
  }
}
