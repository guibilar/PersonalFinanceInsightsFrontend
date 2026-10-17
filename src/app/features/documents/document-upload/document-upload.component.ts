import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { Subscription, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { DocumentRepository } from '../../../core/api/document-repository';
import { HomeRepository } from '../../../core/api/home-repository';
import { HOME_ITEM_LINK } from '../../../core/models/outputs/home-output-dto';
import { TransactionRepository } from '../../../core/api/transaction-repository';
import { DocumentDto } from '../../../core/models/outputs/document-output-dto';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { formatDay } from '../../../shared/utils/format';
import { valueOf } from '../../../shared/utils/resource-value';
import { transactionLink } from '../../transactions/transaction-list/transaction-list-query';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import {
  DocumentDetailsFieldsComponent,
  createDetailsForm,
  detailsOf,
} from '../document-details-fields/document-details-fields.component';
import {
  ACCEPTED_FILES,
  changeError,
  checkFiles,
  formatSize,
  titleFromFileName,
} from '../documents';

/**
 * Adds a document: one or more files (picked, or dropped on the page) and its details. The browser checks the type and
 * size of the files first; the server checks them again and reads the text in the background. After the upload, the
 * document opens.
 *
 * With `?transactionId=<id>` (from the "Documents" section of a transaction in Money), the new document is a receipt by
 * default, and the page links it to that transaction after the upload, then goes back to the transaction.
 *
 * With `?homeItemId=<id>` ("Add receipt or photo" on a Home item), the page links the new document to the item
 * (`Home.Item`) after the upload, then goes back to the item.
 */
@Component({
  selector: 'app-document-upload',
  imports: [RouterLink, IconComponent, DocumentDetailsFieldsComponent, MoneyPipe],
  templateUrl: './document-upload.component.html',
  styleUrl: './document-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentUploadComponent implements OnDestroy {
  private readonly repository = inject(DocumentRepository);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly dataChanges = inject(DataChangesService);
  private readonly transactions = inject(TransactionRepository);
  private readonly home = inject(HomeRepository);
  /** A read-only user (T60) sees why, in place of the form. */
  readonly canWrite = inject(AuthService).canWrite;

  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  /** The transaction to link the new document to, from `?transactionId=`; null without one (or with a bad one). */
  readonly transactionId = linkTarget(this.query.get('transactionId'));
  /** The Home item to link the new document to, from `?homeItemId=` (only without a transaction). */
  readonly homeItemId = this.transactionId ? null : linkTarget(this.query.get('homeItemId'));
  /** Where "back" and "Cancel" go: the transaction, the item, or the Documents list. */
  readonly back = this.transactionId
    ? { ...transactionLink(this.transactionId), label: 'Transaction' }
    : this.homeItemId
      ? { route: `/home/items/${this.homeItemId}`, queryParams: {}, label: 'Item' }
      : { route: '/documents', queryParams: {}, label: 'Documents' };
  /** The transaction, to show what the document will be linked to. */
  readonly transaction = rxResource({
    params: () => this.transactionId ?? undefined,
    stream: ({ params }) => (params ? this.transactions.find(params) : of(null)),
  });
  readonly transactionValue = computed(() => valueOf(this.transaction) ?? null);
  /** The item, to show what the document will be linked to. */
  private readonly item = rxResource({
    params: () => this.homeItemId ?? undefined,
    stream: ({ params }) => this.home.get(params),
  });
  readonly itemName = computed(() => valueOf(this.item)?.name ?? null);

  readonly accept = ACCEPTED_FILES;
  readonly form = createDetailsForm();
  readonly files = signal<File[]>([]);
  readonly problems = computed(() => checkFiles(this.files()));
  readonly dragging = signal(false);

  /** 0 to 100 while the files go up; null when no upload runs. */
  readonly progress = signal<number | null>(null);
  readonly uploading = computed(() => this.progress() !== null);
  /**
   * The document is saved and the page links it: too late to stop. Stopping now would keep the document, unlinked, and
   * leave the form as it was, so a second Upload would add it twice.
   */
  readonly linking = signal(false);
  /** Why the server refused the last upload. */
  readonly serverError = signal<string | null>(null);

  private upload?: Subscription;

  readonly size = formatSize;
  readonly day = formatDay;

  constructor() {
    if (this.transactionId || this.homeItemId) this.form.controls.kind.setValue('Receipt');
  }

  add(list: ArrayLike<File> | null | undefined): void {
    const added = Array.from(list ?? []);
    if (added.length === 0) return;
    // The same file twice (picked again) is kept once.
    const key = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;
    const known = new Set(this.files().map(key));
    this.files.update((files) => [...files, ...added.filter((file) => !known.has(key(file)))]);
    this.serverError.set(null);
    const title = this.form.controls.title;
    if (!title.value.trim()) title.setValue(titleFromFileName(this.files()[0].name));
  }

  remove(file: File): void {
    this.files.update((files) => files.filter((f) => f !== file));
    this.serverError.set(null);
  }

  onPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.add(input.files);
    // The same file can be picked again after a remove.
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    this.dragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    // Leaving for a child of the drop zone is not leaving the zone.
    const zone = event.currentTarget as HTMLElement;
    if (event.relatedTarget instanceof Node && zone.contains(event.relatedTarget)) return;
    this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.add(event.dataTransfer?.files);
  }

  submit(): void {
    if (this.uploading()) return;
    this.form.markAllAsTouched();
    if (this.files().length === 0 || this.problems().length > 0 || this.form.invalid) return;

    this.serverError.set(null);
    this.progress.set(0);
    this.upload = this.repository.upload(this.files(), detailsOf(this.form)).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progress.set(Math.round((100 * event.loaded) / event.total));
        } else if (event.type === HttpEventType.Response && event.body) {
          const document = event.body;
          this.dataChanges.changed();
          this.linking.set(!!(this.transactionId || this.homeItemId));
          if (this.transactionId) {
            this.linkToTransaction(document, this.transactionId);
          } else if (this.homeItemId) {
            this.linkToItem(document, this.homeItemId);
          } else {
            this.progress.set(null);
            this.toasts.success(`Added “${document.title}”`);
            void this.router.navigate(['/documents', document.id]);
          }
        }
      },
      error: (error: unknown) => {
        this.progress.set(null);
        this.serverError.set(changeError(error, 'Could not upload the document.'));
      },
    });
  }

  /** The second step of an upload from a transaction. A failed link keeps the document: its page can link it. */
  private linkToTransaction(document: DocumentDto, transactionId: string): void {
    this.upload = this.repository.linkTransaction(document.id, transactionId).subscribe({
      next: () => {
        this.progress.set(null);
        this.toasts.success(`Added “${document.title}” to the transaction`);
        const { route, queryParams } = transactionLink(transactionId);
        void this.router.navigate([route], { queryParams });
      },
      error: (error: unknown) => {
        this.progress.set(null);
        const readOnly = error instanceof HttpErrorResponse && error.status === 403;
        this.toasts.error(
          `Added “${document.title}”, but could not link it to the transaction.` +
            (readOnly ? ' This account can only read documents.' : ' Link it from its page.'),
        );
        void this.router.navigate(['/documents', document.id]);
      },
    });
  }

  /** The second step of an upload from a Home item. A failed link keeps the document: its page can link it. */
  private linkToItem(document: DocumentDto, itemId: string): void {
    this.upload = this.repository.addLink(document.id, HOME_ITEM_LINK, itemId).subscribe({
      next: () => {
        this.progress.set(null);
        this.dataChanges.changed();
        this.toasts.success(`Added “${document.title}” to the item`);
        void this.router.navigate(['/home/items', itemId]);
      },
      error: (error: unknown) => {
        this.progress.set(null);
        const readOnly = error instanceof HttpErrorResponse && error.status === 403;
        this.toasts.error(
          `Added “${document.title}”, but could not link it to the item.` +
            (readOnly ? ' This account can only read documents.' : ' Link it from its page.'),
        );
        void this.router.navigate(['/documents', document.id]);
      },
    });
  }

  cancel(): void {
    if (this.linking()) return;
    this.upload?.unsubscribe();
    this.progress.set(null);
  }

  ngOnDestroy(): void {
    // Leaving the page stops an upload that is still running.
    this.upload?.unsubscribe();
  }
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The transaction id from the address, when it is a GUID. Another value is ignored: the API would refuse it. */
function linkTarget(value: string | null): string | null {
  const id = value?.trim() ?? '';
  return GUID.test(id) ? id : null;
}
