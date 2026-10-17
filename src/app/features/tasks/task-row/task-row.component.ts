import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TaskSummaryDto } from '../../../core/models/outputs/task-output-dto';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { formatDay } from '../../../shared/utils/format';
import { TaskDoneService } from '../task-done.service';
import { dueText, linkLabels, repeatRule } from '../tasks';

/**
 * How a row describes its task. `due`: when it is due (and its repeat). `recurring`: the repeat and the next date.
 * `done`: when it was done.
 */
export type TaskRowVariant = 'due' | 'recurring' | 'done';

/**
 * One task in a list: a checkbox (done, or undo for a done task), the title (opens the task), when it is due, its
 * repeat, the modules it links to, and its tags (a click filters by the tag).
 */
@Component({
  selector: 'app-task-row',
  imports: [RouterLink, IconComponent],
  template: `
    <div class="task-row" [class.is-done]="isDone()">
      <input
        #box
        type="checkbox"
        class="form-check-input task-check"
        [checked]="isDone()"
        [disabled]="disabled()"
        [attr.aria-label]="(isDone() ? 'Mark not done: ' : 'Mark done: ') + task().title"
        (change)="toggled.emit(task())"
      />
      <a class="flex-grow-1 min-w-0 task-link" [routerLink]="['/tasks', task().id]">
        <span class="d-block task-title text-break">{{ task().title }}</span>
        @if (subtitle(); as text) {
          <span class="d-block small subtitle" [class.text-danger]="late()">{{ text }}</span>
        }
        @if (modules().length > 0) {
          <span class="d-block small fw-semibold text-primary-emphasis">
            <app-icon name="link" [size]="12" /> {{ modules().join(' · ') }}
          </span>
        }
      </a>
      @if (task().tags.length > 0) {
        <span class="d-flex flex-wrap justify-content-end gap-1 tags">
          @for (tag of task().tags; track tag) {
            <button
              type="button"
              class="badge rounded-pill text-bg-light fw-normal border-0 tag"
              [attr.aria-label]="'Show the tasks with the tag ' + tag"
              (click)="tagPicked.emit(tag)"
            >
              #{{ tag }}
            </button>
          }
        </span>
      }
    </div>
  `,
  styles: `
    .task-row {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.625rem 1rem;
    }
    .task-check {
      flex-shrink: 0;
      width: 1.25rem;
      height: 1.25rem;
      margin-top: 0.125rem;
      cursor: pointer;
    }
    .task-link {
      color: inherit;
      text-decoration: none;
      &:hover .task-title {
        text-decoration: underline;
      }
      &:focus-visible {
        outline: 2px solid var(--bs-primary);
        outline-offset: 2px;
      }
    }
    .subtitle {
      color: var(--bs-secondary-color);
    }
    .is-done .task-title {
      text-decoration: line-through;
      color: var(--bs-secondary-color);
    }
    .tags {
      max-width: 40%;
    }
    .tag {
      cursor: pointer;
    }
    .min-w-0 {
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskRowComponent {
  readonly task = input.required<TaskSummaryDto>();
  /** Today, `yyyy-MM-dd`, in the server's time zone. */
  readonly today = input.required<string>();
  readonly variant = input<TaskRowVariant>('due');
  /** A read-only user, or a change in progress. */
  readonly disabled = input(false);
  readonly toggled = output<TaskSummaryDto>();
  readonly tagPicked = output<string>();

  readonly isDone = computed(() => this.task().status === 'Done');
  readonly late = computed(() => {
    const due = this.task().dueOn;
    return !this.isDone() && !!due && due.slice(0, 10) < this.today();
  });
  readonly modules = computed(() => linkLabels(this.task()));
  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  readonly subtitle = computed(() => {
    const task = this.task();
    switch (this.variant()) {
      case 'done':
        return task.doneAt ? `Done ${formatDay(task.doneAt)}` : 'Done';
      case 'recurring':
        return task.repeat
          ? `${repeatRule(task.repeat)} · Next: ${dueText(task.dueOn, this.today())}`
          : '';
      default: {
        const parts = [dueText(task.dueOn, this.today())];
        if (task.repeat) parts.push(repeatRule(task.repeat));
        return parts.filter((part) => part !== '').join(' · ');
      }
    }
  });

  constructor() {
    const failed = inject(TaskDoneService).failed;
    effect(() => {
      // The box ticked itself; `[checked]` did not change, so it would not put it back.
      if (failed()?.id === this.task().id) this.box().nativeElement.checked = this.isDone();
    });
  }
}
