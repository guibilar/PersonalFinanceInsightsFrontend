import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth/auth.service';
import { DocumentRepository } from '../../../core/api/document-repository';
import { TaskRepository } from '../../../core/api/task-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { DOCUMENT_LINK } from '../../../core/models/outputs/task-output-dto';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { valueOf } from '../../../shared/utils/resource-value';
import {
  TaskFieldsComponent,
  createTaskForm,
  taskDetailsOf,
} from '../task-fields/task-fields.component';
import { taskError } from '../tasks';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A new task with all its details. Capture opens it as `/tasks/new`. A document opens it with
 * `?documentId=<id>&title=…&dueOn=…`: the new task links to the document, and the page goes back to the document.
 */
@Component({
  selector: 'app-task-new',
  imports: [RouterLink, TaskFieldsComponent],
  template: `
    <a
      class="back-link small d-inline-flex align-items-center gap-1 mb-2"
      [routerLink]="backLink()"
    >
      ← {{ documentId() ? 'Document' : 'Tasks' }}
    </a>
    <h1 class="h3 mb-3">New task</h1>

    @if (!canWrite()) {
      <p class="alert alert-secondary" data-testid="read-only">This account can only read tasks.</p>
    } @else {
      <div class="card">
        <div class="card-body">
          @if (documentId()) {
            <p class="small text-body-secondary" data-testid="link-note">
              The task links to the document
              @if (documentTitle(); as title) {
                “{{ title }}”.
              } @else {
                that you came from.
              }
            </p>
          }
          <form novalidate (submit)="$event.preventDefault(); save()">
            <app-task-fields [form]="form" />
            <div class="d-flex justify-content-end gap-2 mt-3">
              <a class="btn btn-outline-secondary" [routerLink]="backLink()">Cancel</a>
              <button type="submit" class="btn btn-primary" [disabled]="busy()">
                {{ busy() ? 'Adding…' : 'Add task' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: `
    .back-link {
      color: var(--bs-secondary-color);
      text-decoration: none;
      &:hover {
        color: var(--bs-emphasis-color);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskNewComponent {
  private readonly repository = inject(TaskRepository);
  private readonly documents = inject(DocumentRepository);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly dataChanges = inject(DataChangesService);
  readonly canWrite = inject(AuthService).canWrite;

  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  /** The document to link to. An id that is not a GUID is ignored. */
  readonly documentId = signal(
    GUID.test(this.query.get('documentId') ?? '') ? this.query.get('documentId') : null,
  );
  readonly form = createTaskForm(undefined, {
    title: this.query.get('title') ?? '',
    dueOn: DAY.test(this.query.get('dueOn') ?? '') ? this.query.get('dueOn') : null,
  });
  readonly busy = signal(false);

  /** The document, only to name it on the page. */
  private readonly document = rxResource({
    params: () => this.documentId() ?? undefined,
    stream: ({ params }) => this.documents.get(params),
  });
  readonly documentTitle = computed(() => valueOf(this.document)?.title ?? null);
  readonly backLink = computed(() => {
    const id = this.documentId();
    return id ? ['/documents', id] : ['/tasks'];
  });

  save(): void {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const documentId = this.documentId();
    this.busy.set(true);
    this.repository
      .create({
        ...taskDetailsOf(this.form),
        links: documentId ? [{ kind: DOCUMENT_LINK, targetId: documentId }] : [],
      })
      .subscribe({
        next: (task) => {
          this.busy.set(false);
          this.dataChanges.changed();
          this.toasts.success(`Added “${task.title}”`, {
            label: 'Open',
            route: `/tasks/${task.id}`,
          });
          void this.router.navigate(this.backLink());
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.toasts.error(taskError(error, 'Could not add the task.'));
        },
      });
  }
}
