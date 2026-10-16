import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { DocumentRepository } from '../../../core/api/document-repository';
import { TransactionAddLauncher } from '../../../core/data/transaction-add-launcher.service';
import {
  DocumentDto,
  DocumentSuggestionsDto,
  TransactionMatchDto,
} from '../../../core/models/outputs/document-output-dto';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { formatCurrency, formatDay } from '../../../shared/utils/format';
import { validationDetail } from '../../../shared/utils/problem-detail';
import { HOME_LIMITS } from '../../home/home';

/** True when the suggestions have something to offer. */
export function hasSuggestions(s: DocumentSuggestionsDto | null | undefined): boolean {
  return (
    !!s && (s.total !== null || s.merchant !== null || s.warrantyUntil !== null || s.kind !== null)
  );
}

/**
 * What Hestia read in a document (T100): "Costco Wholesale · Oct 3, 2026 · $33.05", the transactions of that amount near
 * that day (Link), "Add as a transaction" (the form filled in, and the receipt linked to the new transaction), the kind,
 * the warranty end as the expiry, and "Add to inventory". Only after the OCR, and only when there is something to say.
 */
@Component({
  selector: 'app-document-suggestions',
  imports: [IconComponent, RouterLink],
  template: `
    @if (suggestions(); as s) {
      @if (hasSuggestions(s)) {
        <section
          class="card suggestions"
          aria-labelledby="suggestions-heading"
          data-testid="suggestions"
        >
          <div class="card-body d-flex flex-column gap-3">
            <div class="d-flex align-items-center gap-2">
              <span class="spark" aria-hidden="true"
                ><app-icon name="check-circle" [size]="16"
              /></span>
              <h2 id="suggestions-heading" class="h6 mb-0">Hestia read this</h2>
            </div>
            @if (summary(s); as line) {
              <p class="mb-0 fw-semibold" data-testid="receipt-line">{{ line }}</p>
            }

            @if (s.transactions.length > 0) {
              <div>
                <p class="small text-body-secondary mb-2">
                  {{ s.transactions.length === 1 ? 'A transaction matches' : 'Transactions match' }}
                </p>
                <ul class="list-unstyled d-flex flex-column gap-2 mb-0" data-testid="matches">
                  @for (t of s.transactions; track t.id) {
                    <li class="match">
                      <span class="flex-grow-1 min-w-0">
                        <span class="d-block text-truncate">{{ t.description }}</span>
                        <span class="d-block small text-body-secondary">
                          {{ day(t.date) }} · {{ t.accountName }} · {{ money(t.amount) }}
                        </span>
                      </span>
                      @if (t.linked) {
                        <span class="small text-success-emphasis fw-semibold">Linked</span>
                      } @else if (canWrite()) {
                        <button
                          type="button"
                          class="btn btn-sm btn-primary"
                          [disabled]="busy()"
                          (click)="link(t)"
                          [attr.data-testid]="'link-' + t.id"
                        >
                          Link
                        </button>
                      }
                    </li>
                  }
                </ul>
              </div>
            } @else if (!s.transactionsComplete) {
              <p class="small text-body-secondary mb-0">
                Finance did not answer, so the matching transactions are not here.
              </p>
            }

            @if (canWrite()) {
              <div class="d-flex flex-wrap gap-2">
                @if (s.total !== null && !anyLinked(s)) {
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-primary"
                    (click)="addTransaction(s)"
                    data-testid="add-transaction"
                  >
                    <app-icon name="plus" [size]="14" /> Add as a transaction
                  </button>
                }
                @if (s.kind) {
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-secondary"
                    [disabled]="busy()"
                    (click)="setKind(s)"
                    data-testid="set-kind"
                  >
                    Mark as {{ s.kind }}
                  </button>
                }
                @if (s.warrantyUntil && document().expiresOn !== s.warrantyUntil) {
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-secondary"
                    [disabled]="busy()"
                    (click)="setExpiry(s)"
                    data-testid="set-expiry"
                  >
                    Warranty until {{ day(s.warrantyUntil) }}: set as expiry
                  </button>
                }
                @if (s.merchant || s.total !== null) {
                  <a
                    class="btn btn-sm btn-outline-secondary"
                    routerLink="/home/items/new"
                    [queryParams]="newItem(s)"
                    data-testid="add-to-inventory"
                  >
                    <app-icon name="house" [size]="14" /> Add to inventory
                  </a>
                }
              </div>
            }
          </div>
        </section>
      }
    }
  `,
  styles: `
    .suggestions {
      border-color: var(--bs-primary-border-subtle);
      background: var(--bs-primary-bg-subtle);
    }
    .spark {
      display: inline-flex;
      color: var(--bs-primary-text-emphasis);
    }
    .match {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      border-radius: var(--bs-border-radius);
      background: var(--bs-body-bg);
    }
    .min-w-0 {
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentSuggestionsComponent {
  private readonly repository = inject(DocumentRepository);
  private readonly adder = inject(TransactionAddLauncher);
  private readonly toasts = inject(ToastService);

  readonly document = input.required<DocumentDto>();
  readonly canWrite = input(false);
  /** The document changed (a link, the kind, the expiry): the page loads it again. */
  readonly changed = output<void>();
  readonly busy = signal(false);

  readonly suggestionsResource = rxResource({
    params: () => {
      const doc = this.document();
      // Again when the OCR finished or the links changed.
      return doc.ocrStatus === 'Done'
        ? { id: doc.id, links: doc.links.length, updated: doc.updatedAt }
        : undefined;
    },
    stream: ({ params }) => (params ? this.repository.suggestions(params.id) : of(null)),
  });
  readonly suggestions = computed(() =>
    this.suggestionsResource.hasValue() ? this.suggestionsResource.value() : null,
  );

  readonly hasSuggestions = hasSuggestions;
  readonly day = (iso: string) => formatDay(iso);
  readonly money = (amount: number) => formatCurrency(Math.abs(amount));

  /** "Costco Wholesale · Oct 3, 2026 · $33.05". */
  summary(s: DocumentSuggestionsDto): string | null {
    const parts = [
      s.merchant,
      s.date ? formatDay(s.date) : null,
      s.total !== null ? formatCurrency(s.total) : null,
    ];
    const line = parts.filter((p) => !!p).join(' · ');
    return line || null;
  }

  anyLinked(s: DocumentSuggestionsDto): boolean {
    return (
      s.transactions.some((t) => t.linked) ||
      this.document().links.some((l) => l.kind === 'Money.Transaction')
    );
  }

  link(t: TransactionMatchDto): void {
    this.busy.set(true);
    this.repository.linkTransaction(this.document().id, t.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toasts.success(`Linked to “${t.description}”.`);
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toasts.error(validationDetail(error, 'Could not link the transaction.'));
      },
    });
  }

  addTransaction(s: DocumentSuggestionsDto): void {
    this.adder.open({
      description: s.merchant ?? this.document().title,
      amount: s.total,
      date: s.date,
      documentId: this.document().id,
    });
  }

  setKind(s: DocumentSuggestionsDto): void {
    if (s.kind) this.update({ kind: s.kind }, `Marked as ${s.kind}.`);
  }

  setExpiry(s: DocumentSuggestionsDto): void {
    if (s.warrantyUntil)
      this.update({ expiresOn: s.warrantyUntil }, `Expires on ${formatDay(s.warrantyUntil)}.`);
  }

  /** The new home item: the store's name, the total, and the day. */
  newItem(s: DocumentSuggestionsDto): Record<string, string> {
    const item: Record<string, string> = {
      name: (s.merchant ?? this.document().title).slice(0, HOME_LIMITS.name),
    };
    if (s.total !== null) item['price'] = s.total.toFixed(2);
    if (s.date) item['date'] = s.date;
    return item;
  }

  private update(
    change: { kind?: DocumentDto['kind']; expiresOn?: string },
    message: string,
  ): void {
    const doc = this.document();
    this.busy.set(true);
    this.repository
      .update(doc.id, {
        title: doc.title,
        kind: change.kind ?? doc.kind,
        tags: doc.tags,
        issuedOn: doc.issuedOn,
        expiresOn: change.expiresOn ?? doc.expiresOn,
        notes: doc.notes,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.toasts.success(message);
          this.changed.emit();
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.toasts.error(validationDetail(error, 'Could not change the document.'));
        },
      });
  }
}
