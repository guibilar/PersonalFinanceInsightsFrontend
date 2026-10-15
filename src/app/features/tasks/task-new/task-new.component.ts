import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth/auth.service';
import { DocumentRepository } from '../../../core/api/document-repository';
import { HomeRepository } from '../../../core/api/home-repository';
import { TaskRepository } from '../../../core/api/task-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { DOCUMENT_LINK, TRANSACTION_LINK } from '../../../core/models/outputs/task-output-dto';
import { HOME_ITEM_LINK } from '../../../core/models/outputs/home-output-dto';
import { TaskLinkInputDto } from '../../../core/models/inputs/task-input-dto';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { valueOf } from '../../../shared/utils/resource-value';
import {
  TaskFieldsComponent,
  createTaskForm,
  taskDetailsOf,
} from '../task-fields/task-fields.component';
import { transactionLink } from '../../transactions/transaction-list/transaction-list-query';
import { taskError } from '../tasks';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A new task with all its details. Capture opens it as `/tasks/new`. A document opens it with
 * `?documentId=<id>&title=…&dueOn=…`: the new task links to the document, and the page goes back to the document.
 * A Home item opens it with `?homeItemId=<id>` ("Add maintenance"): the task starts as a repeat, every month after
 * each done, links to the item, and the page goes back to the item.
 */
@Component({
  selector: 'app-task-new',
  imports: [RouterLink, TaskFieldsComponent],
  template: `
    <a
      class="back-link small d-inline-flex align-items-center gap-1 mb-2"
      [routerLink]="backLink()"
      [queryParams]="backQuery()"
    >
      ← {{ backLabel() }}
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
          } @else if (homeItemId()) {
            <p class="small text-body-secondary" data-testid="link-note">
              The task links to the item
              @if (itemName(); as name) {
                “{{ name }}”.
              } @else {
                that you came from.
              }
            </p>
          } @else if (transactionId()) {
            <p class="small text-body-secondary" data-testid="link-note">
              The task links to the transaction
              @if (transactionName(); as name) {
                “{{ name }}”.
              } @else {
                that you came from.
              }
            </p>
          }
          <form novalidate (submit)="$event.preventDefault(); save()">
            <app-task-fields [form]="form" />
            <div class="d-flex justify-content-end gap-2 mt-3">
              <a
                class="btn btn-outline-secondary"
                [routerLink]="backLink()"
                [queryParams]="backQuery()"
                >Cancel</a
              >
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
  private readonly home = inject(HomeRepository);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly dataChanges = inject(DataChangesService);
  readonly canWrite = inject(AuthService).canWrite;

  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  /** The document to link to. An id that is not a GUID is ignored. */
  readonly documentId = signal(
    GUID.test(this.query.get('documentId') ?? '') ? this.query.get('documentId') : null,
  );
  /** The Home item to link to (maintenance), when there is no document. An id that is not a GUID is ignored. */
  readonly homeItemId = signal(
    !this.documentId() && GUID.test(this.query.get('homeItemId') ?? '')
      ? this.query.get('homeItemId')
      : null,
  );
  /** The finance transaction to link to (T86), when there is no document and no item. Not a GUID: ignored. */
  readonly transactionId = signal(
    !this.documentId() && !this.homeItemId() && GUID.test(this.query.get('transactionId') ?? '')
      ? this.query.get('transactionId')
      : null,
  );
  /** The description of the transaction, from the address, only to name it on the page. */
  readonly transactionName = signal(this.transactionId() ? this.query.get('transaction') : null);
  readonly form = createTaskForm(undefined, {
    title: this.query.get('title') ?? '',
    dueOn: DAY.test(this.query.get('dueOn') ?? '') ? this.query.get('dueOn') : null,
    repeat: this.homeItemId() ? { every: 1, unit: 'Months', mode: 'FromCompletion' } : null,
  });
  readonly busy = signal(false);

  /** The document, only to name it on the page. */
  private readonly document = rxResource({
    params: () => this.documentId() ?? undefined,
    stream: ({ params }) => this.documents.get(params),
  });
  readonly documentTitle = computed(() => valueOf(this.document)?.title ?? null);

  /** The item, only to name it on the page. */
  private readonly item = rxResource({
    params: () => this.homeItemId() ?? undefined,
    stream: ({ params }) => this.home.get(params),
  });
  readonly itemName = computed(() => valueOf(this.item)?.name ?? null);

  readonly backLink = computed(() => {
    const documentId = this.documentId();
    if (documentId) return ['/documents', documentId];
    const itemId = this.homeItemId();
    if (itemId) return ['/home/items', itemId];
    return this.transactionId() ? [transactionLink(this.transactionId()!).route] : ['/tasks'];
  });
  /** The transaction opens again in the list (T86). */
  readonly backQuery = computed(() => {
    const id = this.transactionId();
    return id ? transactionLink(id).queryParams : null;
  });
  readonly backLabel = computed(() =>
    this.documentId()
      ? 'Document'
      : this.homeItemId()
        ? 'Item'
        : this.transactionId()
          ? 'Transactions'
          : 'Tasks',
  );

  save(): void {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const documentId = this.documentId();
    const itemId = this.homeItemId();
    const transactionId = this.transactionId();
    const links: TaskLinkInputDto[] = documentId
      ? [{ kind: DOCUMENT_LINK, targetId: documentId }]
      : itemId
        ? [{ kind: HOME_ITEM_LINK, targetId: itemId }]
        : transactionId
          ? [{ kind: TRANSACTION_LINK, targetId: transactionId }]
          : [];
    this.busy.set(true);
    this.repository.create({ ...taskDetailsOf(this.form), links }).subscribe({
      next: (task) => {
        this.busy.set(false);
        this.dataChanges.changed();
        this.toasts.success(`Added “${task.title}”`, {
          label: 'Open',
          route: `/tasks/${task.id}`,
        });
        void this.router.navigate(this.backLink(), { queryParams: this.backQuery() });
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toasts.error(taskError(error, 'Could not add the task.'));
      },
    });
  }
}
