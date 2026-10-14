import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth/auth.service';
import { TaskRepository } from '../../../core/api/task-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { TaskCountsService } from '../../../core/data/task-counts.service';
import { DocumentSummaryDto } from '../../../core/models/outputs/document-output-dto';
import { DOCUMENT_LINK } from '../../../core/models/outputs/task-output-dto';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { keptValueOf } from '../../../shared/utils/resource-value';
import { TaskDoneService } from '../task-done.service';
import { TaskRowComponent } from '../task-row/task-row.component';
import { TASK_LIMITS, renewDueOn } from '../tasks';

/**
 * The "Tasks" section of a document: the tasks linked to it (`GET /api/tasks/by-link`), each with a checkbox, and
 * "Add task". For a document with an expiry date, "Add task" starts a task "Renew <title>", due 14 days before the
 * expiry, linked to the document.
 */
@Component({
  selector: 'app-document-tasks',
  imports: [RouterLink, ErrorStateComponent, IconComponent, SkeletonComponent, TaskRowComponent],
  template: `
    <section class="card" aria-labelledby="document-tasks-heading">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
          <h2 id="document-tasks-heading" class="h6 mb-0">Tasks</h2>
          @if (canWrite()) {
            <a
              class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
              routerLink="/tasks/new"
              [queryParams]="newTask()"
              data-testid="add-task"
            >
              <app-icon name="plus" [size]="14" /> Add task
            </a>
          }
        </div>
        @if (tasks.error()) {
          <app-error-state message="Could not load the tasks." (retry)="tasks.reload()" />
        } @else if (!list()) {
          <app-skeleton [lines]="2" height="2.25rem" />
        } @else if (list()!.length === 0) {
          <p class="text-body-secondary small mb-0" data-testid="no-tasks">
            @if (document().expiresOn) {
              Add a task to renew it before it expires.
            } @else {
              No tasks for this document.
            }
          </p>
        } @else {
          <ul class="list-group" data-testid="document-tasks">
            @for (task of list(); track task.id) {
              <li class="list-group-item p-0">
                <app-task-row
                  [task]="task"
                  [today]="today()"
                  [disabled]="!canWrite() || done.busy().has(task.id)"
                  (toggled)="done.toggle($event)"
                  (tagPicked)="openTag($event)"
                />
              </li>
            }
          </ul>
        }
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentTasksComponent {
  private readonly repository = inject(TaskRepository);
  private readonly dataChanges = inject(DataChangesService);
  private readonly router = inject(Router);
  protected readonly done = inject(TaskDoneService);
  readonly canWrite = inject(AuthService).canWrite;
  readonly today = inject(TaskCountsService).today;

  readonly document = input.required<DocumentSummaryDto>();
  private readonly documentId = computed(() => this.document().id);

  readonly tasks = rxResource({
    params: () => ({ id: this.documentId(), version: this.dataChanges.version() }),
    stream: ({ params }) => this.repository.listByLink(DOCUMENT_LINK, params.id),
  });
  readonly list = keptValueOf(this.tasks);

  /** The address of "Add task": the document, and for an expiry the "Renew" title and date. */
  readonly newTask = computed(() => {
    const document = this.document();
    const params: Record<string, string> = { documentId: document.id };
    if (document.expiresOn) {
      params['title'] = `Renew ${document.title}`.slice(0, TASK_LIMITS.title);
      params['dueOn'] = renewDueOn(document.expiresOn.slice(0, 10), this.today());
    }
    return params;
  });

  openTag(tag: string): void {
    void this.router.navigate(['/tasks'], { queryParams: { tag } });
  }
}
