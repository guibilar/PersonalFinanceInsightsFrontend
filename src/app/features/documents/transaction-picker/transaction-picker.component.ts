import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { TransactionRepository } from '../../../core/api/transaction-repository';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { formatDay } from '../../../shared/utils/format';
import { keptValueOf } from '../../../shared/utils/resource-value';

/** How many transactions the picker lists. */
export const PICKER_PAGE_SIZE = 10;

/**
 * "Link to a transaction": the most recent transactions, or the ones whose description matches a search. Picking one
 * emits it; the parent makes the link.
 */
@Component({
  selector: 'app-transaction-picker',
  imports: [ReactiveFormsModule, ErrorStateComponent, ModalComponent, SkeletonComponent, MoneyPipe],
  template: `
    <app-modal title="Link to a transaction" (closed)="closed.emit()">
      <label for="transaction-picker-search" class="form-label">Search descriptions</label>
      <input
        type="search"
        id="transaction-picker-search"
        class="form-control mb-3"
        placeholder="For example costco"
        autocomplete="off"
        [formControl]="search"
      />
      @if (transactions.error()) {
        <app-error-state
          message="Could not load the transactions."
          (retry)="transactions.reload()"
        />
      } @else if (!list()) {
        <app-skeleton [lines]="5" height="2.5rem" />
      } @else if (list()!.length === 0) {
        <p class="text-body-secondary text-center py-4 mb-0">
          {{ term() ? 'No transaction matches “' + term() + '”.' : 'No transactions yet.' }}
        </p>
      } @else {
        <p class="small text-body-secondary mb-2">
          {{ term() ? 'Matching transactions, newest first' : 'Recent transactions' }}
        </p>
        <ul class="list-group" data-testid="picker-transactions">
          @for (transaction of list(); track transaction.id) {
            <li class="list-group-item d-flex align-items-center gap-3">
              <span class="flex-grow-1 min-w-0">
                <span class="d-block text-truncate fw-medium">{{ transaction.description }}</span>
                <span class="d-block small text-body-secondary">
                  {{ day(transaction) }} · {{ transaction.accountName }}
                </span>
              </span>
              <span class="text-nowrap fw-medium">{{ transaction.amount | money }}</span>
              <button
                type="button"
                class="btn btn-sm btn-outline-primary"
                [disabled]="busy() || linkedIds().includes(transaction.id)"
                [attr.aria-label]="'Link ' + transaction.description + ', ' + day(transaction)"
                (click)="picked.emit(transaction)"
              >
                {{ linkedIds().includes(transaction.id) ? 'Linked' : 'Link' }}
              </button>
            </li>
          }
        </ul>
      }
    </app-modal>
  `,
  styles: `
    .min-w-0 {
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionPickerComponent {
  private readonly repository = inject(TransactionRepository);

  /** Transactions the document already links to: shown, but not linked twice. */
  readonly linkedIds = input<string[]>([]);
  /** A link is being made. */
  readonly busy = input(false);
  readonly picked = output<TransactionOutputDto>();
  readonly closed = output<void>();

  readonly search = new FormControl('', { nonNullable: true });
  readonly term = signal('');

  readonly transactions = rxResource({
    params: () => ({ description: this.term() }),
    stream: ({ params }) =>
      this.repository
        .filter({
          ...(params.description ? { description: params.description } : {}),
          sortBy: 'Date',
          sortDirection: 'Descending',
          page: 1,
          pageSize: PICKER_PAGE_SIZE,
        })
        .pipe(map((page) => page.items)),
  });
  private readonly kept = keptValueOf(this.transactions);
  readonly list = computed(() => this.kept());

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

  day(transaction: TransactionOutputDto): string {
    return formatDay(transaction.date);
  }
}
