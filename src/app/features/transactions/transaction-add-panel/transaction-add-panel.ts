import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AccountRepository } from '../../../core/api/account-repository';
import { CategoryRepository } from '../../../core/api/category-repository';
import { TransactionPrefill } from '../../../core/data/transaction-add-launcher.service';
import { TransactionRepository } from '../../../core/api/transaction-repository';
import { TransactionInputDto } from '../../../core/models/inputs/transaction-input-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { conflictDetail, validationDetail } from '../../../shared/utils/problem-detail';
import { TransactionAddForm } from '../transaction-add-form/transaction-add-form';

/**
 * "Add transaction" outside the transactions page: the add form with the accounts and categories it needs, and the
 * save. The shell shows it over any page when Capture opens it.
 */
@Component({
  selector: 'app-transaction-add-panel',
  imports: [RouterLink, TransactionAddForm],
  template: `
    @if (accounts.error() || categories.error()) {
      <div class="alert alert-danger py-2 d-flex align-items-center gap-2" role="alert">
        Could not load your accounts and categories.
        <button type="button" class="btn btn-link btn-sm p-0 ms-auto" (click)="reload()">
          Retry
        </button>
      </div>
    } @else if (accounts.isLoading() || categories.isLoading()) {
      <p class="text-body-secondary mb-0" role="status">Loading accounts…</p>
    } @else if (accounts.value()?.length === 0) {
      <p class="mb-0">
        You have no accounts yet. <a routerLink="/money/accounts">Add one</a> to add its
        transactions.
      </p>
    } @else {
      <app-transaction-add-form
        [accounts]="accounts.value() ?? []"
        [categories]="categories.value() ?? []"
        [saving]="saving()"
        [previous]="previous()"
        [prefill]="prefill()"
        [duplicate]="duplicate()"
        (submitAdd)="onSubmit($event)"
        (cancelled)="cancelled.emit()"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionAddPanel {
  private readonly transactionRepository = inject(TransactionRepository);
  private readonly accountRepository = inject(AccountRepository);
  private readonly categoryRepository = inject(CategoryRepository);
  private readonly toasts = inject(ToastService);

  /** The date and account of the transaction added before, which the form starts on. */
  readonly previous = input<{ date: string; accountId: string } | null>(null);
  /** Values from a receipt (T100). */
  readonly prefill = input<TransactionPrefill | null>(null);
  readonly added = output<TransactionOutputDto>();
  readonly cancelled = output<void>();

  readonly accounts = rxResource({ stream: () => this.accountRepository.getAll() });
  readonly categories = rxResource({ stream: () => this.categoryRepository.getAll() });

  readonly saving = signal(false);
  /** The API's reason when the same transaction exists; the form then offers to add it anyway. */
  readonly duplicate = signal<string | null>(null);

  /** Loads again what failed. */
  reload(): void {
    if (this.accounts.error()) this.accounts.reload();
    if (this.categories.error()) this.categories.reload();
  }

  onSubmit(transaction: TransactionInputDto): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.duplicate.set(null);
    this.transactionRepository.add(transaction).subscribe({
      next: (added) => {
        this.saving.set(false);
        this.added.emit(added);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const detail = conflictDetail(error, '');
        if (detail) {
          this.duplicate.set(detail);
        } else {
          this.toasts.error(validationDetail(error, 'Could not add the transaction.'));
        }
      },
    });
  }
}
