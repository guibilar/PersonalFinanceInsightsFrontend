import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { switchMap, tap } from 'rxjs';
import { TransactionRepository } from '../../../core/api/transaction-repository';
import { CategoryRuleRepository } from '../../../core/api/category-rule-repository';
import { BudgetRepository } from '../../../core/api/budget-repository';
import { AccountRepository } from '../../../core/api/account-repository';
import { CategoryRepository } from '../../../core/api/category-repository';
import { ReportsRepository } from '../../../core/api/reports-repository';
import {
  SortDirection,
  TransactionFilterInputDto,
  TransactionSortField,
} from '../../../core/models/inputs/transaction-filter-input-dto';
import { TransactionInputDto } from '../../../core/models/inputs/transaction-input-dto';
import { TransactionLinkingInputDto } from '../../../core/models/inputs/transaction-linking-input-dto';
import { CategoryRuleInputDto } from '../../../core/models/inputs/category-rule-input-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import {
  BreakdownInterval,
  BreakdownPeriodDto,
} from '../../../core/models/outputs/transaction-breakdown-output-dto';
import { ImportResultOutputDto } from '../../../core/models/outputs/import-result-output-dto';
import { Status } from '../../../core/models/enums/status';
import { TransactionType } from '../../../core/models/enums/transaction-type';
import { Flow } from '../../../core/models/enums/flow';
import { FLOW_LABELS } from '../../../shared/utils/flow-helper';
import { PAGE_SIZE_OPTIONS } from '../../../shared/utils/page-size-options';
import { PaginatedContentComponent } from '../../../shared/ui/paginated-content/paginated-content.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
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
import { TransactionAddForm } from '../transaction-add-form/transaction-add-form';
import { StatementImportComponent } from '../statement-import/statement-import.component';
import { TransactionBreakdownComponent } from '../transaction-breakdown/transaction-breakdown.component';

/** The next interval down, for looking inside a period. */
const CLOSER: Record<BreakdownInterval, BreakdownInterval> = {
  Year: 'Month',
  Quarter: 'Month',
  Month: 'Week',
  Week: 'Week',
};

/** The criteria a link can open the list with: ?categoryId=…&description=…&startDate=…&endDate=…&accountId=… */
function criteriaFromQuery(query: ParamMap): TransactionCriteria {
  const criteria: TransactionCriteria = {};
  for (const key of ['description', 'categoryId', 'accountId', 'startDate', 'endDate'] as const) {
    const value = query.get(key);
    if (value) criteria[key] = value;
  }
  return criteria;
}

function intervalFromQuery(query: ParamMap): BreakdownInterval | null {
  const value = query.get('interval');
  return value && value in CLOSER ? (value as BreakdownInterval) : null;
}

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
    TransactionAddForm,
    StatementImportComponent,
    TransactionBreakdownComponent,
    ConfirmDialogComponent,
    ModalComponent,
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
  private readonly categoryRepository = inject(CategoryRepository);
  private readonly reportsRepository = inject(ReportsRepository);
  private readonly route = inject(ActivatedRoute);
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
    // Links from elsewhere (the dashboard's categories) open the list already filtered.
    ...criteriaFromQuery(this.route.snapshot.queryParamMap),
  });
  readonly linkingTransaction = signal<TransactionOutputDto | null>(null);
  readonly savingLink = signal(false);
  readonly showImport = signal(false);
  readonly showAdd = signal(false);
  readonly savingAdd = signal(false);
  /** What the last transaction added by hand used, so the next one starts on the same day and account. */
  readonly lastAdded = signal<{ date: string; accountId: string } | null>(null);
  /** The API's reason when the transaction being added already exists; the form then offers to add it anyway. */
  readonly addDuplicate = signal<string | null>(null);
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

  /** The totals strip is always there; the chart below it opens on demand (or from a link with ?overTime=1). */
  readonly breakdownOpen = signal(this.route.snapshot.queryParamMap.get('overTime') === '1');
  readonly breakdownInterval = signal<BreakdownInterval>(
    intervalFromQuery(this.route.snapshot.queryParamMap) ?? 'Month',
  );
  // Only the criteria and the interval: paging and sorting the list doesn't change the totals.
  readonly breakdownParams = computed(
    () => {
      const { description, categoryId, accountId, flow, startDate, endDate, hidden } =
        this.filter();
      if (hidden) return undefined;
      return {
        description,
        categoryId,
        accountId,
        flow,
        startDate,
        endDate,
        interval: this.breakdownInterval(),
      };
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  readonly breakdown = rxResource({
    params: () => this.breakdownParams(),
    stream: ({ params }) => this.reportsRepository.getBreakdown(params),
  });
  /** The filtered category's colour, for the chart's bars. */
  readonly breakdownColor = computed(() => {
    const categoryId = this.filter().categoryId;
    return this.categories().find((c) => c.id === categoryId)?.color ?? null;
  });

  readonly hasCriteria = computed(() => {
    const { description, categoryId, accountId, flow, startDate, endDate } = this.filter();
    return !!(description || categoryId || accountId || flow || startDate || endDate);
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

  // For the category filter and the add and edit forms.
  private readonly categoriesResource = rxResource({
    stream: () => this.categoryRepository.getAll(),
  });
  readonly categories = computed(() => this.categoriesResource.value() ?? []);

  protected readonly TransactionType = TransactionType;
  protected readonly Flow = Flow;
  protected readonly applyRulesConfirmation = APPLY_RULES_CONFIRMATION;

  /** After a change to the transactions: the list, and the totals over them. */
  private reload(): void {
    this.transactions.reload();
    this.breakdown.reload();
  }

  /** A bar of the chart: list that period, and look at it a step closer (a month by week, say). */
  onPeriodPicked(period: BreakdownPeriodDto): void {
    this.filter.update((filter) => ({
      ...filter,
      startDate: period.start.slice(0, 10),
      endDate: period.end.slice(0, 10),
      page: 1,
    }));
    this.breakdownInterval.update((interval) => CLOSER[interval]);
  }

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

  onImported(result: ImportResultOutputDto): void {
    this.showImport.set(false);
    this.reload();
    const noun = result.added === 1 ? 'transaction' : 'transactions';
    this.toasts.success(
      `Imported ${result.added} new ${noun}` +
        (result.skipped > 0 ? ` (${result.skipped} already imported)` : ''),
    );
  }

  openAdd(): void {
    this.addDuplicate.set(null);
    this.showAdd.set(true);
  }

  onAddSubmit(input: TransactionInputDto): void {
    if (this.savingAdd()) return;
    this.savingAdd.set(true);
    this.addDuplicate.set(null);
    this.transactionRepository.add(input).subscribe({
      next: (added) => {
        this.savingAdd.set(false);
        this.showAdd.set(false);
        this.lastAdded.set({ date: input.date, accountId: input.accountId });
        this.reload();
        this.toasts.success(`Added “${added.description}” to ${added.accountName}`);
      },
      error: (error: unknown) => {
        this.savingAdd.set(false);
        const detail = conflictDetail(error, '');
        if (detail) {
          this.addDuplicate.set(detail);
        } else {
          this.toasts.error('Could not add the transaction.');
        }
      },
    });
  }

  onLinkSubmit(linking: TransactionLinkingInputDto): void {
    if (this.savingLink()) return;
    this.savingLink.set(true);
    this.transactionRepository.linkTransaction(linking).subscribe({
      next: () => {
        this.savingLink.set(false);
        const budget = this.activeBudgets().find((b) => b.id === linking.budgetId);
        this.linkingTransaction.set(null);
        this.reload();
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
    this.reload();
  }

  applyRules(): void {
    this.confirmingRules.set(false);
    this.applyingRules.set(true);
    this.transactionRepository.applyRules().subscribe({
      next: (result) => {
        this.applyingRules.set(false);
        this.reload();
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
        this.reload();
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
        this.reload();
        this.toasts.success(`Restored “${transaction.description}”`);
      },
      error: () => this.toasts.error('Could not restore the transaction.'),
    });
  }

  onUnlink(id: string): void {
    this.transactionRepository.unlinkTransaction(id).subscribe({
      next: () => {
        this.reload();
        this.toasts.success('Transaction unlinked');
      },
      error: () => this.toasts.error('Could not unlink the transaction.'),
    });
  }
}
