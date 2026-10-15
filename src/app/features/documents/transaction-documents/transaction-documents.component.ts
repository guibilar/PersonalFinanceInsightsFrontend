import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, of } from 'rxjs';
import { DocumentRepository } from '../../../core/api/document-repository';
import { AuthService } from '../../../core/auth/auth.service';
import {
  DocumentSummaryDto,
  MONEY_TRANSACTION_LINK,
} from '../../../core/models/outputs/document-output-dto';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { keptValueOf, valueOf } from '../../../shared/utils/resource-value';
import { changeError } from '../documents';

/** How many documents "Link an existing document" lists. */
export const LINK_CANDIDATES = 5;

/**
 * The "Documents" section of one transaction (Money): its linked documents, each opening its page, "Add document" (the
 * upload page, which links the new document) and "Link an existing document" (a search). The documents come from
 * Hestia.Api (`GET /api/documents/by-link`); the finance API does not know them.
 *
 * A read-only user (T60) sees no actions, only why. A 403 on a link (for example a scope that changed after the
 * sign-in) also hides them.
 */
@Component({
  selector: 'app-transaction-documents',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ConfirmDialogComponent,
    ErrorStateComponent,
    IconComponent,
    SkeletonComponent,
  ],
  template: `
    <section aria-labelledby="transaction-documents-heading">
      <h3 id="transaction-documents-heading" class="h6 mb-2">Documents</h3>

      @if (documents.error()) {
        <app-error-state message="Could not load the documents." (retry)="documents.reload()" />
      } @else if (!list()) {
        <app-skeleton [lines]="2" height="2.5rem" />
      } @else if (list()!.length === 0) {
        <p class="small text-body-secondary mb-2" data-testid="no-documents">
          No documents yet. Add the receipt, for example.
        </p>
      } @else {
        <ul class="list-group mb-2" data-testid="transaction-documents">
          @for (document of list(); track document.id) {
            <li class="list-group-item p-0 d-flex align-items-center">
              <a
                class="document-row flex-grow-1 min-w-0"
                [routerLink]="['/documents', document.id]"
              >
                <app-icon name="file-text" [size]="16" class="text-body-secondary" />
                <span class="flex-grow-1 min-w-0">
                  <span class="d-block text-truncate fw-medium">{{ document.title }}</span>
                  <span class="d-block small text-body-secondary">{{ subtitle(document) }}</span>
                </span>
              </a>
              @if (!readOnly()) {
                <!-- T65: remove the link; the document and the transaction stay. -->
                <button
                  type="button"
                  class="btn btn-icon me-1"
                  title="Unlink"
                  [attr.aria-label]="'Unlink ' + document.title"
                  [disabled]="busy()"
                  (click)="unlinking.set(document)"
                >
                  <app-icon name="close" [size]="16" />
                </button>
              }
            </li>
          }
        </ul>
      }

      @if (readOnly()) {
        <p class="small text-body-secondary mb-0" data-testid="read-only">
          This account can only read documents.
        </p>
      } @else {
        <div class="d-flex flex-wrap gap-2">
          <a
            class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
            routerLink="/documents/new"
            [queryParams]="{ transactionId: transactionId() }"
          >
            <app-icon name="plus" [size]="16" /> Add document
          </a>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
            [attr.aria-expanded]="linking()"
            aria-controls="transaction-documents-link"
            (click)="toggleLinking()"
          >
            <app-icon name="link" [size]="16" /> Link an existing document
          </button>
        </div>

        @if (linking()) {
          <div id="transaction-documents-link" class="rounded border p-3 mt-2">
            <label for="transaction-documents-search" class="form-label small">
              Search documents
            </label>
            <input
              type="search"
              id="transaction-documents-search"
              class="form-control form-control-sm mb-2"
              placeholder="Titles, tags, notes and the text of the files"
              autocomplete="off"
              [formControl]="search"
            />
            @if (candidates.error()) {
              <app-error-state
                message="Could not load the documents."
                (retry)="candidates.reload()"
              />
            } @else if (!candidateList()) {
              <app-skeleton [lines]="3" height="2rem" />
            } @else if (candidateList()!.length === 0) {
              <p class="small text-body-secondary mb-0">
                {{ term() ? 'No document matches “' + term() + '”.' : 'No documents yet.' }}
              </p>
            } @else {
              <p class="small text-body-secondary mb-1">
                {{ term() ? 'Best matches' : 'Recent documents' }}
              </p>
              <ul class="list-unstyled mb-0 d-flex flex-column gap-1" data-testid="link-candidates">
                @for (document of candidateList(); track document.id) {
                  <li class="d-flex align-items-center gap-2">
                    <span class="flex-grow-1 min-w-0">
                      <span class="d-block text-truncate">{{ document.title }}</span>
                      <span class="d-block small text-body-secondary">{{ document.kind }}</span>
                    </span>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-primary"
                      [disabled]="busy() || isLinked(document)"
                      [attr.aria-label]="'Link ' + document.title"
                      (click)="link(document)"
                    >
                      {{ isLinked(document) ? 'Linked' : 'Link' }}
                    </button>
                  </li>
                }
              </ul>
            }
          </div>
        }
      }

      @if (linkError(); as error) {
        <div class="alert alert-danger small py-2 mt-2 mb-0" role="alert" data-testid="link-error">
          {{ error }}
        </div>
      }
      <p class="visually-hidden" aria-live="polite">{{ announcement() }}</p>
    </section>

    @if (unlinking(); as document) {
      <app-confirm-dialog
        title="Remove the link?"
        [message]="'Both stay: this transaction and the document “' + document.title + '”.'"
        [confirmLabel]="busy() ? 'Unlinking…' : 'Unlink'"
        [danger]="true"
        (confirmed)="unlink(document)"
        (cancelled)="unlinking.set(null)"
      />
    }
  `,
  styles: `
    .document-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      color: inherit;
      text-decoration: none;
    }
    .document-row:hover,
    .document-row:focus-visible {
      background: var(--bs-tertiary-bg);
    }
    .min-w-0 {
      min-width: 0;
    }
    .btn-icon {
      display: inline-flex;
      padding: 0.3125rem;
      color: var(--bs-secondary-color);
      &:hover {
        color: var(--bs-danger);
        background: var(--bs-secondary-bg);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionDocumentsComponent {
  private readonly repository = inject(DocumentRepository);

  readonly transactionId = input.required<string>();

  readonly documents = rxResource({
    params: () => this.transactionId(),
    stream: ({ params }) => this.repository.listByTransaction(params),
  });
  private readonly kept = keptValueOf(this.documents);
  readonly list = computed(() => this.kept());

  readonly linking = signal(false);
  /** The document whose link the person wants to remove (T65), until confirmed or cancelled. */
  readonly unlinking = signal<DocumentSummaryDto | null>(null);
  readonly busy = signal(false);
  private readonly auth = inject(AuthService);
  /** The server refused a change with 403. */
  private readonly refused = signal(false);
  readonly readOnly = computed(() => this.refused() || !this.auth.canWrite());
  readonly linkError = signal<string | null>(null);
  readonly announcement = signal('');

  readonly search = new FormControl('', { nonNullable: true });
  readonly term = signal('');

  readonly candidates = rxResource({
    params: () => (this.linking() ? { q: this.term() } : undefined),
    stream: ({ params }) =>
      params
        ? this.repository
            .list({ q: params.q || null, page: 1, pageSize: LINK_CANDIDATES })
            .pipe(map((page) => page.items))
        : of([]),
  });
  private readonly keptCandidates = keptValueOf(this.candidates);
  readonly candidateList = computed(() => this.keptCandidates());

  private readonly linkedIds = computed(
    () => new Set((valueOf(this.documents) ?? []).map((d) => d.id)),
  );

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

  subtitle(document: DocumentSummaryDto): string {
    const files = document.files.length;
    return `${document.kind} · ${files} ${files === 1 ? 'file' : 'files'}`;
  }

  isLinked(document: DocumentSummaryDto): boolean {
    return this.linkedIds().has(document.id);
  }

  toggleLinking(): void {
    this.linking.update((open) => !open);
    this.linkError.set(null);
  }

  link(document: DocumentSummaryDto): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.linkError.set(null);
    this.repository.linkTransaction(document.id, this.transactionId()).subscribe({
      next: () => this.linked(document),
      error: (error: unknown) => {
        this.busy.set(false);
        // The link exists already (for example from another tab): the list is simply out of date.
        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.linked(document);
          return;
        }
        if (error instanceof HttpErrorResponse && error.status === 403) {
          this.refused.set(true);
          return;
        }
        this.linkError.set(changeError(error, 'Could not link the document.'));
      },
    });
  }

  /** Removes the link of the document to this transaction (T65). The document and the transaction stay. */
  unlink(document: DocumentSummaryDto): void {
    const link = document.links.find(
      (l) =>
        l.kind === MONEY_TRANSACTION_LINK &&
        l.targetId.toLowerCase() === this.transactionId().toLowerCase(),
    );
    this.unlinking.set(null);
    if (!link || this.busy()) return;
    this.busy.set(true);
    this.linkError.set(null);
    this.repository.unlink(document.id, link.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.announcement.set(`Unlinked “${document.title}”.`);
        this.documents.reload();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        if (error instanceof HttpErrorResponse && error.status === 403) {
          this.refused.set(true);
          return;
        }
        this.linkError.set(changeError(error, 'Could not unlink the document.'));
      },
    });
  }

  private linked(document: DocumentSummaryDto): void {
    this.busy.set(false);
    this.linking.set(false);
    this.announcement.set(`Linked “${document.title}”.`);
    this.documents.reload();
  }
}
