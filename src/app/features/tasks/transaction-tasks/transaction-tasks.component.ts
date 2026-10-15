import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth/auth.service';
import { TaskRepository } from '../../../core/api/task-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { TRANSACTION_LINK, TaskSummaryDto } from '../../../core/models/outputs/task-output-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { formatDay } from '../../../shared/utils/format';
import { keptValueOf } from '../../../shared/utils/resource-value';

/**
 * The "Tasks" section of one transaction (Money, T86): the tasks that link to it
 * (`GET /api/tasks/by-link?kind=Money.Transaction`), each opening the task, and "Add task". That opens a new task with
 * the link to the transaction.
 *
 * Against the finance backend alone, the request fails: the section then shows only "Add task", as the Home
 * inventory section does.
 */
@Component({
  selector: 'app-transaction-tasks',
  imports: [RouterLink, IconComponent],
  template: `
    <section aria-labelledby="transaction-tasks-heading">
      <h3 id="transaction-tasks-heading" class="h6 mb-2">Tasks</h3>
      @if (list(); as tasks) {
        @if (tasks.length > 0) {
          <ul class="list-group mb-2" data-testid="transaction-tasks">
            @for (task of tasks; track task.id) {
              <li class="list-group-item p-0">
                <a class="task-link" [routerLink]="['/tasks', task.id]">
                  <app-icon name="list-checks" [size]="16" class="text-body-secondary" />
                  <span class="flex-grow-1 min-w-0 text-truncate fw-medium">{{ task.title }}</span>
                  <span class="text-nowrap small text-body-secondary">{{ state(task) }}</span>
                </a>
              </li>
            }
          </ul>
        }
      }
      @if (canWrite()) {
        <a
          class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
          routerLink="/tasks/new"
          [queryParams]="newTask()"
          data-testid="add-task"
        >
          <app-icon name="plus" [size]="16" /> Add task
        </a>
      } @else if (list()?.length === 0) {
        <p class="small text-body-secondary mb-0">No tasks.</p>
      }
    </section>
  `,
  styles: `
    .task-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      color: inherit;
      text-decoration: none;
      &:hover .fw-medium {
        text-decoration: underline;
      }
    }
    .min-w-0 {
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionTasksComponent {
  private readonly repository = inject(TaskRepository);
  private readonly dataChanges = inject(DataChangesService);
  /** A read-only user (T60) sees the tasks, without "Add task". */
  readonly canWrite = inject(AuthService).canWrite;

  readonly transaction = input.required<TransactionOutputDto>();
  private readonly transactionId = computed(() => this.transaction().id);

  readonly tasks = rxResource({
    params: () => ({ id: this.transactionId(), version: this.dataChanges.version() }),
    stream: ({ params }) => this.repository.listByLink(TRANSACTION_LINK, params.id),
  });
  readonly list = keptValueOf(this.tasks);

  /** The address of "Add task": the transaction and its description (to name it on the page). */
  readonly newTask = computed(() => ({
    transactionId: this.transaction().id,
    transaction: this.transaction().description,
  }));

  /** "Done", "Due Oct 16, 2026", or nothing. */
  state(task: TaskSummaryDto): string {
    if (task.status === 'Done') return 'Done';
    return task.dueOn ? `Due ${formatDay(task.dueOn)}` : '';
  }
}
