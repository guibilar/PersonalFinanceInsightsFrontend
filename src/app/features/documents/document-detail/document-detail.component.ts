import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { DocumentRepository } from '../../../core/api/document-repository';
import { TransactionRepository } from '../../../core/api/transaction-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import {
  DocumentDto,
  DocumentFileDto,
  DocumentLinkDto,
  MONEY_TRANSACTION_LINK,
} from '../../../core/models/outputs/document-output-dto';
import { HOME_ITEM_LINK } from '../../../core/models/outputs/home-output-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { formatDay } from '../../../shared/utils/format';
import { keptValueOf } from '../../../shared/utils/resource-value';
import { transactionLink } from '../../transactions/transaction-list/transaction-list-query';
import {
  DocumentDetailsFieldsComponent,
  DocumentDetailsForm,
  createDetailsForm,
  detailsOf,
} from '../document-details-fields/document-details-fields.component';
import { TransactionPickerComponent } from '../transaction-picker/transaction-picker.component';
import { DocumentTasksComponent } from '../../tasks/document-tasks/document-tasks.component';
import { LinkedItemsComponent } from '../../home/linked-items/linked-items.component';
import {
  DOCUMENT_POLLING,
  changeError,
  daysUntil,
  expiryText,
  fileIcon,
  formatSize,
  previewKind,
} from '../documents';

/** The links that the "Linked transactions" section shows: all but the Home items. */
function notHomeItem(link: DocumentLinkDto): boolean {
  return link.kind !== HOME_ITEM_LINK;
}

/** A link as the page shows it: a transaction (found, deleted, or not found), or another kind as plain text. */
export interface LinkView {
  link: DocumentLinkDto;
  /** For a transaction link: the transaction, or null when finance does not know it. */
  transaction?: TransactionOutputDto | null;
}

/**
 * One document: its details (edit them), its files (view and download), the text read from them, its links to
 * transactions, and delete. While the text is still being read, the page loads the document again every few seconds.
 */
@Component({
  selector: 'app-document-detail',
  imports: [
    RouterLink,
    MoneyPipe,
    ConfirmDialogComponent,
    DocumentDetailsFieldsComponent,
    DocumentTasksComponent,
    ErrorStateComponent,
    LinkedItemsComponent,
    IconComponent,
    SkeletonComponent,
    TransactionPickerComponent,
  ],
  templateUrl: './document-detail.component.html',
  styleUrl: './document-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentDetailComponent {
  private readonly repository = inject(DocumentRepository);
  private readonly transactions = inject(TransactionRepository);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly dataChanges = inject(DataChangesService);
  private readonly polling = inject(DOCUMENT_POLLING);
  /** A read-only user (T60) gets no edit, delete, OCR retry, link or unlink. */
  readonly canWrite = inject(AuthService).canWrite;

  readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });
  /** Goes up to load the document again (after a change, or to poll). */
  private readonly version = signal(0);

  readonly documentResource = rxResource({
    params: () => ({ id: this.id(), version: this.version() }),
    stream: ({ params }) => this.repository.get(params.id),
  });
  /** The last answer stays while the next one loads, so a poll does not flash the page. */
  readonly document = keptValueOf(this.documentResource);
  readonly notFound = computed(() => {
    const error = this.documentResource.error();
    return error instanceof HttpErrorResponse && error.status === 404;
  });

  /** When the page started to wait for the text, or null when it does not wait. */
  private readonly waitingSince = signal<number | null>(null);
  /** The text took longer than the polling allows: the page stops asking. */
  readonly stoppedPolling = signal(false);

  readonly editing = signal(false);
  readonly form = signal<DocumentDetailsForm | null>(null);
  readonly busy = signal(false);
  readonly confirmingDelete = signal(false);
  readonly unlinking = signal<LinkView | null>(null);
  readonly picking = signal(false);

  /**
   * The links of this section: all but the Home items, which show in their own section. The same list again (a poll)
   * is not a change, so finance is not asked again.
   */
  private readonly links = computed(() => this.document()?.links.filter(notHomeItem), {
    equal: (a, b) => a?.map((l) => l.id).join() === b?.map((l) => l.id).join(),
  });

  /** The links, each with its transaction. Finance is asked once for each linked transaction. */
  readonly linkViews = rxResource({
    params: () => {
      const links = this.links();
      return links ? { links } : undefined;
    },
    stream: ({ params }) =>
      params.links.length === 0
        ? of([] as LinkView[])
        : forkJoin(params.links.map((link) => this.viewOf(link))),
  });
  /** The number of links in the "Linked transactions" section. */
  readonly linkCount = computed(() => this.links()?.length ?? 0);
  readonly linkedTransactionIds = computed(() =>
    (this.document()?.links ?? [])
      .filter((link) => link.kind === MONEY_TRANSACTION_LINK)
      .map((link) => link.targetId),
  );

  readonly size = formatSize;
  readonly icon = fileIcon;
  readonly preview = previewKind;

  constructor() {
    // Poll while the text is read: every few seconds, up to the limit.
    const destroyRef = inject(DestroyRef);
    let timer: ReturnType<typeof setTimeout> | undefined;
    destroyRef.onDestroy(() => clearTimeout(timer));
    effect(() => {
      const document = this.document();
      const loading = this.documentResource.isLoading();
      untracked(() => {
        clearTimeout(timer);
        if (!document || loading || document.ocrStatus !== 'Pending') {
          if (document && document.ocrStatus !== 'Pending') this.waitingSince.set(null);
          return;
        }
        const since = this.waitingSince() ?? Date.now();
        this.waitingSince.set(since);
        if (Date.now() - since >= this.polling.maxMs) {
          this.stoppedPolling.set(true);
          return;
        }
        timer = setTimeout(() => this.version.update((v) => v + 1), this.polling.intervalMs);
      });
    });
  }

  fileUrl(file: DocumentFileDto, inline = false): string {
    return this.repository.fileUrl(this.id(), file.id, inline);
  }

  day(iso: string): string {
    return formatDay(iso);
  }

  expiry(document: DocumentDto): string {
    return document.expiresOn ? expiryText(daysUntil(document.expiresOn, new Date())) : '';
  }

  transactionLink(id: string) {
    return transactionLink(id);
  }

  /** Loads the page again, and starts the wait for the text again. */
  reload(): void {
    this.stoppedPolling.set(false);
    this.waitingSince.set(null);
    this.version.update((v) => v + 1);
  }

  startEdit(document: DocumentDto): void {
    this.form.set(createDetailsForm(document));
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.form.set(null);
  }

  save(): void {
    const form = this.form();
    if (!form || this.busy()) return;
    form.markAllAsTouched();
    if (form.invalid) return;
    this.busy.set(true);
    this.repository.update(this.id(), detailsOf(form)).subscribe({
      next: (document) => {
        this.busy.set(false);
        this.cancelEdit();
        this.dataChanges.changed();
        this.toasts.success(`Saved “${document.title}”`);
        this.version.update((v) => v + 1);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toasts.error(changeError(error, 'Could not save the details.'));
      },
    });
  }

  retryOcr(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.repository.retryOcr(this.id()).subscribe({
      next: () => {
        this.busy.set(false);
        this.toasts.success('The text is read again.');
        this.reload();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toasts.error(changeError(error, 'Could not run the OCR again.'));
      },
    });
  }

  confirmDelete(document: DocumentDto): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.repository.delete(document.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.confirmingDelete.set(false);
        this.dataChanges.changed();
        this.toasts.success(`Deleted “${document.title}”`);
        void this.router.navigateByUrl('/documents');
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.confirmingDelete.set(false);
        this.toasts.error(changeError(error, 'Could not delete the document.'));
      },
    });
  }

  link(transaction: TransactionOutputDto): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.repository.linkTransaction(this.id(), transaction.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.picking.set(false);
        this.toasts.success(`Linked to “${transaction.description}”`);
        this.version.update((v) => v + 1);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toasts.error(changeError(error, 'Could not link the transaction.'));
      },
    });
  }

  confirmUnlink(view: LinkView): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.repository.unlink(this.id(), view.link.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.unlinking.set(null);
        this.toasts.success('Unlinked');
        this.version.update((v) => v + 1);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.unlinking.set(null);
        this.toasts.error(changeError(error, 'Could not unlink.'));
      },
    });
  }

  /** "Costco, Oct 3, 2026": what the unlink confirmation names. */
  linkName(view: LinkView): string {
    const t = view.transaction;
    return t ? `“${t.description}”, ${formatDay(t.date)}` : 'this transaction';
  }

  /** A transaction link with its transaction: visible, else deleted, else unknown (null). */
  private viewOf(link: DocumentLinkDto) {
    if (link.kind !== MONEY_TRANSACTION_LINK) return of<LinkView>({ link });
    return this.transactions.find(link.targetId).pipe(
      switchMap((found) => (found ? of(found) : this.transactions.find(link.targetId, true))),
      map((transaction): LinkView => ({ link, transaction })),
      catchError(() => of<LinkView>({ link, transaction: null })),
    );
  }
}
