import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { DocumentRepository } from '../../../core/api/document-repository';
import { HomeRepository } from '../../../core/api/home-repository';
import { TransactionRepository } from '../../../core/api/transaction-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import {
  DocumentDto,
  DocumentFileDto,
  DocumentSummaryDto,
} from '../../../core/models/outputs/document-output-dto';
import {
  HOME_ITEM_LINK,
  ITEM_DOCUMENT_LINK,
  ITEM_TRANSACTION_LINK,
  ItemDocumentDto,
  ItemDto,
  ItemLinkDto,
  ItemTaskDto,
} from '../../../core/models/outputs/home-output-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { formatDay } from '../../../shared/utils/format';
import { keptValueOf, valueOf } from '../../../shared/utils/resource-value';
import { DocumentPickerComponent } from '../../documents/document-picker/document-picker.component';
import { previewKind } from '../../documents/documents';
import { TransactionPickerComponent } from '../../documents/transaction-picker/transaction-picker.component';
import { TaskDoneService } from '../../tasks/task-done.service';
import { transactionLink } from '../../transactions/transaction-list/transaction-list-query';
import {
  ItemFieldsComponent,
  ItemForm,
  createItemForm,
  itemDetailsOf,
} from '../item-fields/item-fields.component';
import {
  HOME_TODAY,
  daysLeftText,
  homeError,
  maintenanceRule,
  warrantyBadge,
  warrantyOf,
} from '../home';

/** A document of the item as the page shows it: with its files (for a photo), or null when it cannot be read. */
export interface ItemDocumentView {
  document: ItemDocumentDto;
  full: DocumentDto | null;
  /** The first image file that a browser can show, for a photo. */
  photo: DocumentFileDto | null;
}

/** The purchase of the item: the transaction (visible, else deleted), or null when finance does not know it. */
export interface PurchaseView {
  link: ItemLinkDto;
  transaction: TransactionOutputDto | null;
}

/**
 * One item: its details (edit them), the warranty state, its documents (an image shows as a photo), its purchase,
 * its maintenance tasks, and delete. "Add receipt or photo" uploads a document with the link, "Link a document" and
 * "Link the purchase" pick one, and "Add maintenance" opens a new repeated task with the link.
 */
@Component({
  selector: 'app-item-detail',
  imports: [
    RouterLink,
    MoneyPipe,
    ConfirmDialogComponent,
    DocumentPickerComponent,
    ErrorStateComponent,
    IconComponent,
    ItemFieldsComponent,
    SkeletonComponent,
    TransactionPickerComponent,
  ],
  templateUrl: './item-detail.component.html',
  styleUrl: './item-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDetailComponent {
  private readonly repository = inject(HomeRepository);
  private readonly documents = inject(DocumentRepository);
  private readonly transactions = inject(TransactionRepository);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly dataChanges = inject(DataChangesService);
  /** A read-only user (T60) gets no edit, delete, link, unlink, or add. */
  /** Done and undo of a maintenance task (T89). */
  protected readonly done = inject(TaskDoneService);
  readonly canWrite = inject(AuthService).canWrite;
  readonly today = inject(HOME_TODAY)();
  private readonly boxes = viewChildren<ElementRef<HTMLInputElement>>('box');

  readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });

  readonly itemResource = rxResource({
    params: () => ({ id: this.id(), version: this.dataChanges.version() }),
    stream: ({ params }) => this.repository.get(params.id),
  });
  /** The last answer stays while the next one loads, so a change does not flash the page. */
  readonly item = keptValueOf(this.itemResource);
  readonly notFound = computed(() => {
    const error = this.itemResource.error();
    return error instanceof HttpErrorResponse && error.status === 404;
  });

  /** The rooms, for the edit form. Loaded when the edit starts. */
  readonly editing = signal(false);
  private readonly roomsResource = rxResource({
    params: () => (this.editing() ? true : undefined),
    stream: () => this.repository.rooms(),
  });
  readonly rooms = computed(() => valueOf(this.roomsResource) ?? []);

  readonly form = signal<ItemForm | null>(null);
  readonly busy = signal(false);
  readonly confirmingDelete = signal(false);
  readonly unlinkingDocument = signal<ItemDocumentView | null>(null);
  readonly unlinkingPurchase = signal<PurchaseView | null>(null);
  readonly picking = signal<'document' | 'transaction' | null>(null);

  readonly warranty = computed(() => {
    const item = this.item();
    return item ? warrantyOf(item.warrantyUntil, this.today) : null;
  });
  readonly warrantyClass = computed(() => {
    const warranty = this.warranty();
    return warranty ? `badge rounded-pill ${warrantyBadge(warranty.state)}` : '';
  });

  /** The documents; the same list again is not a change, so they are not asked for again. */
  private readonly documentList = computed(() => this.item()?.documents, {
    equal: (a, b) => a?.map((d) => d.id).join() === b?.map((d) => d.id).join(),
  });
  readonly documentViews = rxResource({
    params: () => {
      const documents = this.documentList();
      return documents ? { documents } : undefined;
    },
    stream: ({ params }) =>
      params.documents.length === 0
        ? of([] as ItemDocumentView[])
        : forkJoin(params.documents.map((document) => this.documentView(document))),
  });

  private readonly purchaseLinks = computed(
    () => this.item()?.links.filter((link) => link.kind === ITEM_TRANSACTION_LINK),
    { equal: (a, b) => a?.map((l) => l.id).join() === b?.map((l) => l.id).join() },
  );
  readonly purchases = rxResource({
    params: () => {
      const links = this.purchaseLinks();
      return links ? { links } : undefined;
    },
    stream: ({ params }) =>
      params.links.length === 0
        ? of([] as PurchaseView[])
        : forkJoin(params.links.map((link) => this.purchaseView(link))),
  });
  readonly linkedIds = computed(() => {
    const item = this.item();
    return {
      documents: item?.documents.map((d) => d.id) ?? [],
      transactions: this.purchaseLinks()?.map((l) => l.targetId) ?? [],
    };
  });

  constructor() {
    effect(() => {
      // The box ticked itself; `[checked]` did not change, so it would not put it back.
      const id = this.done.failed()?.id;
      const task = this.item()?.maintenance.find((t) => t.id === id);
      for (const box of this.boxes())
        if (task && box.nativeElement.dataset['task'] === id)
          box.nativeElement.checked = task.status === 'Done';
    });
  }

  day(iso: string): string {
    return formatDay(iso);
  }

  fileUrl(documentId: string, file: DocumentFileDto): string {
    return this.documents.fileUrl(documentId, file.id, true);
  }

  transactionLink(id: string) {
    return transactionLink(id);
  }

  rule(task: ItemTaskDto): string {
    return maintenanceRule(task);
  }

  next(task: ItemTaskDto): string {
    if (task.status === 'Done') return 'Done';
    if (!task.dueOn) return 'No date';
    return `${formatDay(task.dueOn)} · ${daysLeftText(task.dueOn, this.today)}`;
  }

  late(task: ItemTaskDto): boolean {
    return task.status === 'Open' && !!task.dueOn && task.dueOn.slice(0, 10) < this.today;
  }

  /** "Bosch · SHX78". */
  maker(item: ItemDto): string {
    return [item.brand, item.model].filter((part) => !!part).join(' · ');
  }

  startEdit(item: ItemDto): void {
    this.form.set(createItemForm(item));
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.form.set(null);
  }

  save(item: ItemDto): void {
    const form = this.form();
    if (!form || this.busy()) return;
    form.markAllAsTouched();
    if (form.invalid) return;
    this.busy.set(true);
    this.repository.update(item.id, itemDetailsOf(form)).subscribe({
      next: (saved) => {
        this.busy.set(false);
        this.cancelEdit();
        this.dataChanges.changed();
        this.toasts.success(`Saved “${saved.name}”`);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toasts.error(homeError(error, 'Could not save the item.'));
      },
    });
  }

  confirmDelete(item: ItemDto): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.repository.delete(item.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.confirmingDelete.set(false);
        this.toasts.success(`Deleted “${item.name}”`);
        const back = item.roomId ? `/home/rooms/${item.roomId}` : '/home';
        // Leave first: a change before would load the deleted item again.
        void this.router.navigateByUrl(back).then(() => this.dataChanges.changed());
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.confirmingDelete.set(false);
        this.toasts.error(homeError(error, 'Could not delete the item.'));
      },
    });
  }

  linkDocument(document: DocumentSummaryDto): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.repository
      .addLink(this.id(), { kind: ITEM_DOCUMENT_LINK, targetId: document.id })
      .subscribe({
        next: () => this.linked(`Linked “${document.title}”`),
        error: (error: unknown) => this.failed(error, 'Could not link the document.'),
      });
  }

  /**
   * Links the purchase. When the item has no price or no purchase day yet, they come from the transaction (the
   * amount without its sign).
   */
  linkPurchase(item: ItemDto, transaction: TransactionOutputDto): void {
    if (this.busy()) return;
    this.busy.set(true);
    const fill = item.purchasePrice === null || item.purchasedOn === null;
    this.repository
      .addLink(item.id, { kind: ITEM_TRANSACTION_LINK, targetId: transaction.id })
      .pipe(
        switchMap(() =>
          fill
            ? this.repository.update(item.id, {
                ...itemDetailsOf(createItemForm(item)),
                purchasePrice: item.purchasePrice ?? Math.abs(transaction.amount),
                purchasedOn: item.purchasedOn ?? transaction.date.slice(0, 10),
              })
            : of(null),
        ),
      )
      .subscribe({
        next: (filled) =>
          this.linked(
            filled
              ? `Linked “${transaction.description}”, with its price and day`
              : `Linked “${transaction.description}”`,
          ),
        error: (error: unknown) => {
          // The link can be made, and only the fill failed: show what the server has now.
          this.dataChanges.changed();
          this.failed(error, 'Could not link the purchase.');
        },
      });
  }

  /** Removes the link from the side that has it: the item, or the document (a `Home.Item` link). */
  confirmUnlinkDocument(view: ItemDocumentView): void {
    const item = this.item();
    if (!item || this.busy()) return;
    const own = item.links.find(
      (link) => link.kind === ITEM_DOCUMENT_LINK && link.targetId === view.document.id,
    );
    const fromDocument = view.full?.links.find(
      (link) => link.kind === HOME_ITEM_LINK && link.targetId === item.id,
    );
    let request: Observable<void>;
    if (own) request = this.repository.removeLink(item.id, own.id);
    else if (fromDocument) request = this.documents.unlink(view.document.id, fromDocument.id);
    else {
      this.unlinkingDocument.set(null);
      this.toasts.error('Could not find the link. Unlink it on the document page.');
      return;
    }
    this.unlink(request, () => this.unlinkingDocument.set(null));
  }

  confirmUnlinkPurchase(view: PurchaseView): void {
    if (this.busy()) return;
    this.unlink(this.repository.removeLink(this.id(), view.link.id), () =>
      this.unlinkingPurchase.set(null),
    );
  }

  /** "“Costco”, Oct 3, 2026": what the unlink confirmation names. */
  purchaseName(view: PurchaseView): string {
    const t = view.transaction;
    return t ? `“${t.description}”, ${formatDay(t.date)}` : 'this transaction';
  }

  private unlink(request: Observable<void>, close: () => void): void {
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        close();
        this.dataChanges.changed();
        this.toasts.success('Unlinked');
      },
      error: (error: unknown) => {
        this.busy.set(false);
        close();
        this.toasts.error(homeError(error, 'Could not unlink.'));
      },
    });
  }

  private linked(message: string): void {
    this.busy.set(false);
    this.picking.set(null);
    this.dataChanges.changed();
    this.toasts.success(message);
  }

  private failed(error: unknown, fallback: string): void {
    this.busy.set(false);
    this.toasts.error(homeError(error, fallback));
  }

  private documentView(document: ItemDocumentDto): Observable<ItemDocumentView> {
    return this.documents.get(document.id).pipe(
      map((full): ItemDocumentView => ({
        document,
        full,
        photo: full.files.find((file) => previewKind(file) === 'image') ?? null,
      })),
      catchError(() => of<ItemDocumentView>({ document, full: null, photo: null })),
    );
  }

  private purchaseView(link: ItemLinkDto): Observable<PurchaseView> {
    return this.transactions.find(link.targetId).pipe(
      switchMap((found) => (found ? of(found) : this.transactions.find(link.targetId, true))),
      map((transaction): PurchaseView => ({ link, transaction })),
      catchError(() => of<PurchaseView>({ link, transaction: null })),
    );
  }
}
