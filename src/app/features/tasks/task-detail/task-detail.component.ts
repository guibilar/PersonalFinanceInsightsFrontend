import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { DocumentRepository } from '../../../core/api/document-repository';
import { TaskRepository } from '../../../core/api/task-repository';
import { TransactionRepository } from '../../../core/api/transaction-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { TaskCountsService } from '../../../core/data/task-counts.service';
import { DocumentSummaryDto } from '../../../core/models/outputs/document-output-dto';
import {
  DOCUMENT_LINK,
  TRANSACTION_LINK,
  TaskDto,
  TaskLinkDto,
} from '../../../core/models/outputs/task-output-dto';
import { TaskLinkInputDto } from '../../../core/models/inputs/task-input-dto';
import { HOME_ITEM_LINK } from '../../../core/models/outputs/home-output-dto';
import { PEOPLE_PERSON_LINK } from '../../../core/models/outputs/people-output-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { formatDay } from '../../../shared/utils/format';
import { keptValueOf } from '../../../shared/utils/resource-value';
import { DocumentPickerComponent } from '../../documents/document-picker/document-picker.component';
import { TransactionPickerComponent } from '../../documents/transaction-picker/transaction-picker.component';
import { LinkedItemsComponent } from '../../home/linked-items/linked-items.component';
import { LinkedPeopleComponent } from '../../people/linked-people/linked-people.component';
import { transactionLink } from '../../transactions/transaction-list/transaction-list-query';
import { TaskDoneService } from '../task-done.service';
import {
  TaskFieldsComponent,
  TaskForm,
  createTaskForm,
  taskDetailsOf,
} from '../task-fields/task-fields.component';
import { dueText, repeatRule, taskError } from '../tasks';

/** A link as the page shows it: a document or a transaction (null when it is not found), or another kind as text. */
export interface TaskLinkView {
  link: TaskLinkDto;
  document?: DocumentSummaryDto | null;
  transaction?: TransactionOutputDto | null;
}

/**
 * One task: done or undo, its details (edit them, with the repeat), its links to documents and transactions, the last
 * times it was done, and delete.
 */
@Component({
  selector: 'app-task-detail',
  imports: [
    RouterLink,
    MoneyPipe,
    ConfirmDialogComponent,
    DocumentPickerComponent,
    ErrorStateComponent,
    IconComponent,
    LinkedItemsComponent,
    LinkedPeopleComponent,
    SkeletonComponent,
    TaskFieldsComponent,
    TransactionPickerComponent,
  ],
  templateUrl: './task-detail.component.html',
  styleUrl: './task-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDetailComponent {
  private readonly repository = inject(TaskRepository);
  private readonly documents = inject(DocumentRepository);
  private readonly transactions = inject(TransactionRepository);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly dataChanges = inject(DataChangesService);
  protected readonly doneService = inject(TaskDoneService);
  /** A read-only user (T60) gets no done, edit, delete, link or unlink. */
  readonly canWrite = inject(AuthService).canWrite;
  readonly today = inject(TaskCountsService).today;

  readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });

  readonly taskResource = rxResource({
    params: () => ({ id: this.id(), version: this.dataChanges.version() }),
    stream: ({ params }) => this.repository.get(params.id),
  });
  /** The last answer stays while the next one loads, so a change does not flash the page. */
  readonly task = keptValueOf(this.taskResource);
  readonly notFound = computed(() => {
    const error = this.taskResource.error();
    return error instanceof HttpErrorResponse && error.status === 404;
  });

  readonly editing = signal(false);
  readonly form = signal<TaskForm | null>(null);
  readonly busy = signal(false);
  readonly confirmingDelete = signal(false);
  readonly unlinking = signal<TaskLinkView | null>(null);
  readonly picking = signal<'document' | 'transaction' | null>(null);

  /**
   * The links of the "Links" section: all but the Home items, which show in their own section. The same list again is
   * not a change, so the linked things are not asked for again.
   */
  private readonly links = computed(
    () =>
      this.task()?.links.filter(
        (link) => link.kind !== HOME_ITEM_LINK && link.kind !== PEOPLE_PERSON_LINK,
      ),
    {
      equal: (a, b) => a?.map((l) => l.id).join() === b?.map((l) => l.id).join(),
    },
  );
  /** The number of links in the "Links" section. */
  readonly linkCount = computed(() => this.links()?.length ?? 0);

  /** The links, each with its document or transaction. */
  readonly linkViews = rxResource({
    params: () => {
      const links = this.links();
      return links ? { links } : undefined;
    },
    stream: ({ params }) =>
      params.links.length === 0
        ? of([] as TaskLinkView[])
        : forkJoin(params.links.map((link) => this.viewOf(link))),
  });
  readonly linkedIds = computed(() => {
    const links = this.task()?.links ?? [];
    return {
      documents: links.filter((l) => l.kind === DOCUMENT_LINK).map((l) => l.targetId),
      transactions: links.filter((l) => l.kind === TRANSACTION_LINK).map((l) => l.targetId),
    };
  });

  readonly isBusy = computed(() => this.busy() || this.doneService.busy().has(this.id()));

  day(iso: string): string {
    return formatDay(iso);
  }

  due(task: TaskDto): string {
    return task.dueOn ? `${formatDay(task.dueOn)} (${dueText(task.dueOn, this.today())})` : '—';
  }

  rule(task: TaskDto): string {
    return task.repeat ? repeatRule(task.repeat) : 'Does not repeat';
  }

  late(task: TaskDto): boolean {
    return task.status === 'Open' && !!task.dueOn && task.dueOn.slice(0, 10) < this.today();
  }

  transactionLink(id: string) {
    return transactionLink(id);
  }

  markDone(task: TaskDto): void {
    this.doneService.done(task);
  }

  undo(task: TaskDto): void {
    this.doneService.undo(task);
  }

  startEdit(task: TaskDto): void {
    this.form.set(createTaskForm(task));
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.form.set(null);
  }

  save(task: TaskDto): void {
    const form = this.form();
    if (!form || this.busy()) return;
    form.markAllAsTouched();
    if (form.invalid) return;
    this.busy.set(true);
    this.repository.update(task.id, taskDetailsOf(form, task.sortOrder)).subscribe({
      next: (saved) => {
        this.busy.set(false);
        this.cancelEdit();
        this.dataChanges.changed();
        this.toasts.success(`Saved “${saved.title}”`);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toasts.error(taskError(error, 'Could not save the task.'));
      },
    });
  }

  confirmDelete(task: TaskDto): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.repository.delete(task.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.confirmingDelete.set(false);
        this.toasts.success(`Deleted “${task.title}”`);
        // Leave first: a change before would load the deleted task again.
        void this.router.navigateByUrl('/tasks').then(() => this.dataChanges.changed());
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.confirmingDelete.set(false);
        this.toasts.error(taskError(error, 'Could not delete the task.'));
      },
    });
  }

  linkDocument(document: DocumentSummaryDto): void {
    this.addLink({ kind: DOCUMENT_LINK, targetId: document.id }, `Linked to “${document.title}”`);
  }

  linkTransaction(transaction: TransactionOutputDto): void {
    this.addLink(
      { kind: TRANSACTION_LINK, targetId: transaction.id },
      `Linked to “${transaction.description}”`,
    );
  }

  confirmUnlink(view: TaskLinkView): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.repository.removeLink(this.id(), view.link.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.unlinking.set(null);
        this.dataChanges.changed();
        this.toasts.success('Unlinked');
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.unlinking.set(null);
        this.toasts.error(taskError(error, 'Could not unlink.'));
      },
    });
  }

  /** What the unlink confirmation names: "“Car insurance”" or "“Costco”, Oct 3, 2026". */
  linkName(view: TaskLinkView): string {
    if (view.document) return `“${view.document.title}”`;
    const t = view.transaction;
    if (t) return `“${t.description}”, ${formatDay(t.date)}`;
    return view.link.kind === DOCUMENT_LINK ? 'this document' : 'this item';
  }

  private addLink(link: TaskLinkInputDto, done: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.repository.addLink(this.id(), link).subscribe({
      next: () => {
        this.busy.set(false);
        this.picking.set(null);
        this.dataChanges.changed();
        this.toasts.success(done);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toasts.error(taskError(error, 'Could not make the link.'));
      },
    });
  }

  /** A link with its item: a document, a transaction (visible, else deleted), or null when it is not found. */
  private viewOf(link: TaskLinkDto) {
    if (link.kind === DOCUMENT_LINK) {
      return this.documents.get(link.targetId).pipe(
        map((document): TaskLinkView => ({ link, document })),
        catchError(() => of<TaskLinkView>({ link, document: null })),
      );
    }
    if (link.kind === TRANSACTION_LINK) {
      return this.transactions.find(link.targetId).pipe(
        switchMap((found) => (found ? of(found) : this.transactions.find(link.targetId, true))),
        map((transaction): TaskLinkView => ({ link, transaction })),
        catchError(() => of<TaskLinkView>({ link, transaction: null })),
      );
    }
    return of<TaskLinkView>({ link });
  }
}
