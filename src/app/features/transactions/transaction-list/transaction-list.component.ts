import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { TransactionRepository } from '../../../core/api/transaction-repository';
import { BudgetRepository } from '../../../core/api/budget-repository';
import { TransactionFilterInputDto } from '../../../core/models/inputs/transaction-filter-input-dto';
import { TransactionLinkingInputDto } from '../../../core/models/inputs/transaction-linking-input-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { Status } from '../../../core/models/enums/status';
import { TransactionType } from '../../../core/models/enums/transaction-type';
import { CategoryColorHelper } from '../../../shared/utils/category-color-helper';
import { PaginatedContentComponent } from '../../../shared/ui/paginated-content/paginated-content.component';
import { LoaderComponent } from '../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { FilterField, TransactionFilterComponent } from '../transaction-filter/transaction-filter.component';
import { TransactionLinkForm } from '../transaction-link-form/transaction-link-form';

@Component({
  selector: 'app-transaction-list',
  templateUrl: './transaction-list.component.html',
  imports: [
    CurrencyPipe,
    DatePipe,
    PaginatedContentComponent,
    TransactionFilterComponent,
    TransactionLinkForm,
    LoaderComponent,
    ErrorStateComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionListComponent {
  private readonly transactionRepository = inject(TransactionRepository);
  private readonly budgetRepository = inject(BudgetRepository);

  readonly enabledFilters: FilterField[] = ['pageSize', 'startDate', 'endDate', 'category', 'description'];

  readonly filter = signal<TransactionFilterInputDto>({ page: 1, pageSize: 10 });
  readonly linkingTransaction = signal<TransactionOutputDto | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly transactions = rxResource({
    params: () => this.filter(),
    stream: ({ params }) => this.transactionRepository.filter(params)
  });

  // Link dropdown needs every active budget, not just the first page.
  private readonly activeBudgetsResource = rxResource({
    stream: () => this.budgetRepository.filter({ status: Status.Active, page: 1, pageSize: 1000 })
  });
  readonly activeBudgets = computed(() => this.activeBudgetsResource.value()?.items ?? []);

  protected readonly TransactionType = TransactionType;

  onPageChange(page: number): void {
    this.filter.update((filter) => ({ ...filter, page }));
  }

  onFilterChange(newFilter: TransactionFilterInputDto): void {
    this.filter.set({ ...newFilter, page: 1 });
  }

  getCategoryColor(category: string): string {
    return CategoryColorHelper.getColor(category);
  }

  onLinkingTransaction(transaction: TransactionOutputDto): void {
    this.linkingTransaction.set(transaction);
  }

  onFormSubmit(linking: TransactionLinkingInputDto): void {
    this.transactionRepository.linkTransaction(linking).subscribe({
      next: () => {
        this.linkingTransaction.set(null);
        this.transactions.reload();
      },
      error: () => this.actionError.set('Could not link the transaction.')
    });
  }

  onUnlinkSubmit(id: string): void {
    this.transactionRepository.unlinkTransaction(id).subscribe({
      next: () => this.transactions.reload(),
      error: () => this.actionError.set('Could not unlink the transaction.')
    });
  }

  onFormCancel(): void {
    this.linkingTransaction.set(null);
  }
}
