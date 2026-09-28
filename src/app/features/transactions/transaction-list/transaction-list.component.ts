import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { switchMap, tap } from 'rxjs';
import { TransactionRepository } from '../../../core/api/transaction-repository';
import { CategoryRuleRepository } from '../../../core/api/category-rule-repository';
import { BudgetRepository } from '../../../core/api/budget-repository';
import { AccountRepository } from '../../../core/api/account-repository';
import {
  SortDirection,
  TransactionFilterInputDto,
  TransactionSortField,
} from '../../../core/models/inputs/transaction-filter-input-dto';
import { TransactionLinkingInputDto } from '../../../core/models/inputs/transaction-linking-input-dto';
import { CategoryRuleInputDto } from '../../../core/models/inputs/category-rule-input-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { ImportResultOutputDto } from '../../../core/models/outputs/import-result-output-dto';
import { Status } from '../../../core/models/enums/status';
import { TransactionType } from '../../../core/models/enums/transaction-type';
import { Flow } from '../../../core/models/enums/flow';
import { FLOW_LABELS } from '../../../shared/utils/flow-helper';
import { CategoryColorHelper } from '../../../shared/utils/category-color-helper';
import { PAGE_SIZE_OPTIONS } from '../../../shared/utils/page-size-options';
import { PaginatedContentComponent } from '../../../shared/ui/paginated-content/paginated-content.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SidePanelComponent } from '../../../shared/ui/side-panel/side-panel.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { conflictDetail } from '../../../shared/utils/problem-detail';
import {
  APPLY_RULES_CONFIRMATION,
  describeRulesResult,
} from '../../../shared/utils/category-rules-messages';
import {
  TransactionCriteria,
  TransactionToolbarComponent,
} from '../transaction-toolbar/transaction-toolbar.component';
import { TransactionLinkForm } from '../transaction-link-form/transaction-link-form';
import {
  TransactionEditForm,
  TransactionEditSubmission,
} from '../transaction-edit-form/transaction-edit-form';
import { StatementImportComponent } from '../statement-import/statement-import.component';

interface SortableColumn {
  field: TransactionSortField;
  label: string;
}

// Text columns start A→Z; date and amount start with the largest/newest.
const DEFAULT_DIRECTION: Record<TransactionSortField, SortDirection> = {
  Date: 'Descending',
  Amount: 'Descending',
  Description: 'Ascending',
  Category: 'Ascending',
};

@Component({
  selector: 'app-transaction-list',
  templateUrl: './transaction-list.component.html',
  styleUrl: './transaction-list.component.scss',
  imports: [
    CurrencyPipe,
    DatePipe,
    PaginatedContentComponent,
    TransactionToolbarComponent,
    TransactionLinkForm,
    TransactionEditForm,
    StatementImportComponent,
    ConfirmDialogComponent,
    SidePanelComponent,
    SkeletonComponent,
    ErrorStateComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionListComponent {
  private readonly transactionRepository = inject(TransactionRepository);
  private readonly budgetRepository = inject(BudgetRepository);
  private readonly categoryRuleRepository = inject(CategoryRuleRepository);
  private readonly accountRepository = inject(AccountRepository);
  private readonly toasts = inject(ToastService);

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly columns: Record<'date' | 'description' | 'category' | 'amount', SortableColumn> = {
    date: { field: 'Date', label: 'Date' },
    description: { field: 'Description', label: 'Description' },
    category: { field: 'Category', label: 'Category' },
    amount: { field: 'Amount', label: 'Amount' },
  };

  readonly filter = signal<TransactionFilterInputDto>({
    page: 1,
    pageSize: 25,
    sortBy: 'Date',
    sortDirection: 'Descending',
  });
  readonly linkingTransaction = signal<TransactionOutputDto | null>(null);
  readonly savingLink = signal(false);
  readonly showImport = signal(false);
  readonly editingTransaction = signal<TransactionOutputDto | null>(null);
  readonly savingEdit = signal(false);
  readonly confirmingRules = signal(false);
  readonly applyingRules = signal(false);
  /** Asked to delete; the confirm dialog is showing. */
  readonly deletingTransaction = signal<TransactionOutputDto | null>(null);
  readonly removing = signal(false);
  /** Deleted transactions are listed instead of the others, each with a Restore button. */
  readonly showDeleted = computed(() => !!this.filter().hidden);

  readonly transactions = rxResource({
    params: () => this.filter(),
    stream: ({ params }) => this.transactionRepository.filter(params),
  });

  readonly hasCriteria = computed(() => {
    const { description, category, accountId, flow, startDate, endDate } = this.filter();
    return !!(description || category || accountId || flow || startDate || endDate);
  });

  // Link dropdown needs every active budget, not just the first page.
  private readonly activeBudgetsResource = rxResource({
    stream: () => this.budgetRepository.filter({ status: Status.Active, page: 1, pageSize: 1000 }),
  });
  readonly activeBudgets = computed(() => this.activeBudgetsResource.value()?.items ?? []);

  // For the account filter.
  private readonly accountsResource = rxResource({
    stream: () => this.accountRepository.getAll(),
  });
  readonly accounts = computed(() => this.accountsResource.value() ?? []);

  protected readonly TransactionType = TransactionType;
  protected readonly Flow = Flow;
  protected readonly applyRulesConfirmation = APPLY_RULES_CONFIRMATION;

  onCriteriaChange(criteria: TransactionCriteria): void {
    this.filter.update(({ pageSize, sortBy, sortDirection, hidden }) => ({
      ...criteria,
      pageSize,
      sortBy,
      sortDirection,
      hidden,
      page: 1,
    }));
  }

  /** Switches between the transactions and the deleted ones, keeping search and sort. */
  toggleDeleted(): void {
    this.filter.update((filter) => ({
      ...filter,
      hidden: filter.hidden ? undefined : true,
      page: 1,
    }));
  }

  onPageChange(page: number): void {
    this.filter.update((filter) => ({ ...filter, page }));
  }

  onPageSizeChange(pageSize: number): void {
    this.filter.update((filter) => ({ ...filter, pageSize, page: 1 }));
  }

  /** Same column: flip direction. New column: its natural direction. */
  sort(field: TransactionSortField): void {
    this.filter.update((filter) => ({
      ...filter,
      page: 1,
      sortBy: field,
      sortDirection:
        filter.sortBy === field
          ? filter.sortDirection === 'Ascending'
            ? 'Descending'
            : 'Ascending'
          : DEFAULT_DIRECTION[field],
    }));
  }

  ariaSort(field: TransactionSortField): 'ascending' | 'descending' | 'none' {
    const { sortBy, sortDirection } = this.filter();
    if (sortBy !== field) return 'none';
    return sortDirection === 'Ascending' ? 'ascending' : 'descending';
  }

  sortIcon(field: TransactionSortField): 'sort-asc' | 'sort-desc' | 'sort-none' {
    const direction = this.ariaSort(field);
    return direction === 'ascending'
      ? 'sort-asc'
      : direction === 'descending'
        ? 'sort-desc'
        : 'sort-none';
  }

  clearCriteria(): void {
    this.onCriteriaChange({});
  }

  flowLabel(flow: Flow): string {
    return FLOW_LABELS[flow];
  }

  getCategoryColor(category: string): string {
    return CategoryColorHelper.getColor(category);
  }

  onImported(result: ImportResultOutputDto): void {
    this.showImport.set(false);
    this.transactions.reload();
    const noun = result.added === 1 ? 'transaction' : 'transactions';
    this.toasts.success(
      `Imported ${result.added} new ${noun}` +
        (result.skipped > 0 ? ` (${result.skipped} already imported)` : ''),
    );
  }

  onLinkSubmit(linking: TransactionLinkingInputDto): void {
    if (this.savingLink()) return;
    this.savingLink.set(true);
    this.transactionRepository.linkTransaction(linking).subscribe({
      next: () => {
        this.savingLink.set(false);
        const budget = this.activeBudgets().find((b) => b.id === linking.budgetId);
        this.linkingTransaction.set(null);
        this.transactions.reload();
        this.toasts.success(budget ? `Linked to “${budget.name}”` : 'Transaction linked');
      },
      error: () => {
        this.savingLink.set(false);
        this.toasts.error('Could not link the transaction.');
      },
    });
  }

  onEditSubmit({ update, rule }: TransactionEditSubmission): void {
    const transaction = this.editingTransaction();
    if (!transaction || this.savingEdit()) return;
    this.savingEdit.set(true);
    this.transactionRepository.update(transaction.id, update).subscribe({
      next: () => {
        if (rule) {
          this.addRuleAndApply(rule);
        } else {
          this.finishEdit();
          this.toasts.success('Transaction updated');
        }
      },
      error: () => {
        this.savingEdit.set(false);
        this.toasts.error('Could not update the transaction.');
      },
    });
  }

  /** After the edit is saved: the rule goes first, then the rules are applied, with one toast for it all. */
  private addRuleAndApply(rule: CategoryRuleInputDto): void {
    let added = false;
    this.categoryRuleRepository
      .create(rule)
      .pipe(
        tap(() => (added = true)),
        switchMap(() => this.transactionRepository.applyRules()),
      )
      .subscribe({
        next: ({ updated }) => {
          this.finishEdit();
          const others = `${updated} other ${updated === 1 ? 'transaction' : 'transactions'}`;
          this.toasts.success(
            `Transaction updated. Rule “${rule.keyword}” added and ${others} updated`,
          );
        },
        error: (error: unknown) => {
          // The transaction itself is saved either way.
          this.finishEdit();
          this.toasts.error(
            added
              ? `Transaction updated and rule “${rule.keyword}” added, but the rules could not be applied.`
              : `Transaction updated, but the rule could not be added: ${conflictDetail(error, 'please try again.')}`,
          );
        },
      });
  }

  private finishEdit(): void {
    this.savingEdit.set(false);
    this.editingTransaction.set(null);
    this.transactions.reload();
  }

  applyRules(): void {
    this.confirmingRules.set(false);
    this.applyingRules.set(true);
    this.transactionRepository.applyRules().subscribe({
      next: (result) => {
        this.applyingRules.set(false);
        this.transactions.reload();
        this.toasts.success(describeRulesResult(result));
      },
      error: () => {
        this.applyingRules.set(false);
        this.toasts.error('Could not apply the rules.');
      },
    });
  }

  confirmDelete(): void {
    const transaction = this.deletingTransaction();
    if (!transaction || this.removing()) return;
    this.removing.set(true);
    this.transactionRepository.remove(transaction.id).subscribe({
      next: () => {
        this.removing.set(false);
        this.deletingTransaction.set(null);
        this.editingTransaction.set(null);
        this.transactions.reload();
        this.toasts.success(`Deleted “${transaction.description}”`);
      },
      error: () => {
        this.removing.set(false);
        this.deletingTransaction.set(null);
        this.toasts.error('Could not delete the transaction.');
      },
    });
  }

  restore(transaction: TransactionOutputDto): void {
    this.transactionRepository.restore(transaction.id).subscribe({
      next: () => {
        this.transactions.reload();
        this.toasts.success(`Restored “${transaction.description}”`);
      },
      error: () => this.toasts.error('Could not restore the transaction.'),
    });
  }

  onUnlink(id: string): void {
    this.transactionRepository.unlinkTransaction(id).subscribe({
      next: () => {
        this.transactions.reload();
        this.toasts.success('Transaction unlinked');
      },
      error: () => this.toasts.error('Could not unlink the transaction.'),
    });
  }
}
