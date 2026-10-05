import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, ParamMap, Params, Router } from '@angular/router';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, tap } from 'rxjs';
import { TransactionRepository } from '../../../core/api/transaction-repository';
import { CategoryRuleRepository } from '../../../core/api/category-rule-repository';
import { BudgetRepository } from '../../../core/api/budget-repository';
import { AccountRepository } from '../../../core/api/account-repository';
import { CategoryRepository } from '../../../core/api/category-repository';
import { ReportsRepository } from '../../../core/api/reports-repository';
import { TagRepository } from '../../../core/api/tag-repository';
import {
  SortDirection,
  TransactionFilterInputDto,
  TransactionSortField,
} from '../../../core/models/inputs/transaction-filter-input-dto';
import { TransactionInputDto } from '../../../core/models/inputs/transaction-input-dto';
import { TransactionLinkingInputDto } from '../../../core/models/inputs/transaction-linking-input-dto';
import { CategoryRuleInputDto } from '../../../core/models/inputs/category-rule-input-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { TransactionBulkUpdateInputDto } from '../../../core/models/inputs/transaction-bulk-update-input-dto';
import {
  BreakdownInterval,
  BreakdownPeriodDto,
} from '../../../core/models/outputs/transaction-breakdown-output-dto';
import { ImportSummary } from '../statement-import/statement-import.component';
import { Status } from '../../../core/models/enums/status';
import { TransactionType } from '../../../core/models/enums/transaction-type';
import { Flow } from '../../../core/models/enums/flow';
import { FLOW_LABELS } from '../../../shared/utils/flow-helper';
import { formatCurrency } from '../../dashboard/chart-helper';
import { PAGE_SIZE_OPTIONS } from '../../../shared/utils/page-size-options';
import { PaginatedContentComponent } from '../../../shared/ui/paginated-content/paginated-content.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { conflictDetail, validationDetail } from '../../../shared/utils/problem-detail';
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
import { valueOf } from '../../../shared/utils/resource-value';

/** The next interval down, for looking inside a period. */
const CLOSER: Record<BreakdownInterval, BreakdownInterval> = {
  Year: 'Month',
  Quarter: 'Month',
  Month: 'Week',
  Week: 'Week',
};

const CRITERIA_KEYS = [
  'description',
  'categoryId',
  'tagId',
  'accountId',
  'flow',
  'startDate',
  'endDate',
] as const;

/** The criteria a link can open the list with: ?categoryId=…&tagId=…&description=…&startDate=…&endDate=…&accountId=… */
function criteriaFromQuery(query: ParamMap): TransactionCriteria {
  const criteria: TransactionCriteria = {};
  for (const key of CRITERIA_KEYS) {
    const value = query.get(key);
    if (!value) continue;
    if (key === 'flow') {
      if (Object.values(Flow).includes(value as Flow)) criteria.flow = value as Flow;
    } else {
      criteria[key] = value;
    }
  }
  return criteria;
}

/** The criteria that are set, as a query string would carry them. */
function definedCriteria(criteria: TransactionCriteria): Record<string, string> {
  const defined: Record<string, string> = {};
  for (const key of CRITERIA_KEYS) {
    const value = criteria[key];
    if (value) defined[key] = value;
  }
  return defined;
}

function sameCriteria(a: TransactionCriteria, b: TransactionCriteria): boolean {
  return JSON.stringify(definedCriteria(a)) === JSON.stringify(definedCriteria(b));
}

function intervalFromQuery(query: ParamMap): BreakdownInterval | null {
  const value = query.get('interval');
  return value && value in CLOSER ? (value as BreakdownInterval) : null;
}

/** Marks the navigations the list makes itself to keep the address up to date, so it doesn't apply them back. */
const OWN_NAVIGATION = 'transactionListFilters';

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
  private readonly tagRepository = inject(TagRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
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
  /** Ticked for a bulk change; cleared when the list shows other transactions. */
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly selectedCount = computed(() => this.selected().size);
  readonly bulkSaving = signal(false);
  protected readonly flows = Object.values(Flow);
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
      const { description, categoryId, tagId, accountId, flow, startDate, endDate, hidden } =
        this.filter();
      if (hidden) return undefined;
      return {
        description,
        categoryId,
        tagId,
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
  /** The totals, or nothing while they load or when they failed (the strip then offers a retry). */
  readonly breakdownValue = computed(() => valueOf(this.breakdown));
  /** The filtered category's colour, for the chart's bars. */
  readonly breakdownColor = computed(() => {
    const categoryId = this.filter().categoryId;
    return this.categories().find((c) => c.id === categoryId)?.color ?? null;
  });

  readonly hasCriteria = computed(() => {
    const { description, categoryId, tagId, accountId, flow, startDate, endDate } = this.filter();
    return !!(description || categoryId || tagId || accountId || flow || startDate || endDate);
  });

  // Link dropdown needs every active budget, not just the first page.
  private readonly activeBudgetsResource = rxResource({
    stream: () => this.budgetRepository.filter({ status: Status.Active, page: 1, pageSize: 1000 }),
  });
  readonly activeBudgets = computed(() => valueOf(this.activeBudgetsResource)?.items ?? []);

  // For the account filter.
  private readonly accountsResource = rxResource({
    stream: () => this.accountRepository.getAll(),
  });
  readonly accounts = computed(() => valueOf(this.accountsResource) ?? []);

  // For the category filter and the add and edit forms.
  private readonly categoriesResource = rxResource({
    stream: () => this.categoryRepository.getAll(),
  });
  readonly categories = computed(() => valueOf(this.categoriesResource) ?? []);

  // For the tag filter, the edit form and the bulk bar; reloaded after a change, for tags added meanwhile.
  private readonly tagsResource = rxResource({
    stream: () => this.tagRepository.getAll(),
  });
  readonly tags = computed(() => valueOf(this.tagsResource) ?? []);

  /** The address the page should have: its criteria, and the chart when it is open. */
  private readonly urlQuery = computed<Params>(() => {
    const query: Params = definedCriteria(this.filter());
    if (this.breakdownOpen()) {
      query['overTime'] = '1';
      // Month is what the chart opens on, so it goes without saying.
      if (this.breakdownInterval() !== 'Month') query['interval'] = this.breakdownInterval();
    }
    return query;
  });

  constructor() {
    // The address follows the criteria, so a refresh, the back button or a copied link shows the same list...
    effect(() => {
      const queryParams = this.urlQuery();
      untracked(() => {
        const current = this.route.snapshot.queryParamMap;
        const same =
          current.keys.length === Object.keys(queryParams).length &&
          Object.entries(queryParams).every(([key, value]) => current.get(key) === value);
        if (same) return;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams,
          replaceUrl: true,
          state: { [OWN_NAVIGATION]: true },
        });
      });
    });
    // ...and a link to the page while it is open (the menu's, or the dashboard's) applies its criteria.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      if (this.router.lastSuccessfulNavigation()?.extras.state?.[OWN_NAVIGATION]) return;
      const criteria = criteriaFromQuery(query);
      if (!sameCriteria(criteria, this.filter())) this.onCriteriaChange(criteria);
      this.breakdownOpen.set(query.get('overTime') === '1');
      this.breakdownInterval.set(intervalFromQuery(query) ?? 'Month');
    });
    // Another page, other filters or the deleted view: what was ticked isn't on screen any more.
    effect(() => {
      this.filter();
      untracked(() => this.clearSelection());
    });
    // Years of weeks are charted by month (or longer) instead: the buttons and the address say what is shown.
    effect(() => {
      if (this.breakdown.isLoading() || !this.breakdown.hasValue()) return;
      const used = valueOf(this.breakdown)?.interval;
      if (used && used !== untracked(this.breakdownInterval)) this.breakdownInterval.set(used);
    });
  }

  protected readonly TransactionType = TransactionType;
  protected readonly Flow = Flow;
  protected readonly applyRulesConfirmation = APPLY_RULES_CONFIRMATION;

  /** After a change to the transactions: the list, and the totals over them. */
  protected reload(): void {
    this.transactions.reload();
    this.breakdown.reload();
    this.tagsResource.reload();
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

  /** A tag on a row: the transactions with it, within the other criteria. */
  filterByTag(tagId: string): void {
    const { description, categoryId, accountId, flow, startDate, endDate } = this.filter();
    this.onCriteriaChange({ description, categoryId, accountId, flow, startDate, endDate, tagId });
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

  onImported(result: ImportSummary): void {
    this.showImport.set(false);
    this.reload();
    const noun = result.added === 1 ? 'transaction' : 'transactions';
    const balance =
      result.balance != null && result.balanceDate
        ? `; balance on ${new Date(result.balanceDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}: ${formatCurrency(result.balance)}`
        : '';
    this.toasts.success(
      `Imported ${result.added} new ${noun}` +
        (result.files > 1 ? ` from ${result.files} files` : '') +
        (result.skipped > 0 ? ` (${result.skipped} already imported)` : '') +
        balance,
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
          this.toasts.error(validationDetail(error, 'Could not add the transaction.'));
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
      error: (error: unknown) => {
        this.savingLink.set(false);
        // A 409 says why: the budget was deactivated meanwhile, or the transaction linked elsewhere.
        this.toasts.error(conflictDetail(error, 'Could not link the transaction.'));
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
      error: (error: unknown) => {
        this.savingEdit.set(false);
        // The API's reason when it refused the change (a category deleted meanwhile, say), as on Android.
        this.toasts.error(validationDetail(error, 'Could not update the transaction.'));
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

  isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.selected());
    if (!next.delete(id)) next.add(id);
    this.selected.set(next);
  }

  allSelected(items: TransactionOutputDto[]): boolean {
    return items.length > 0 && items.every((t) => this.selected().has(t.id));
  }

  /** Ticks (or unticks) every transaction on the page. */
  toggleAll(items: TransactionOutputDto[], checked: boolean): void {
    const next = new Set(this.selected());
    for (const transaction of items) {
      if (checked) next.add(transaction.id);
      else next.delete(transaction.id);
    }
    this.selected.set(next);
  }

  clearSelection(): void {
    if (this.selected().size > 0) this.selected.set(new Set());
  }

  /** "add:<id>" or "remove:<id>", from the bulk bar's tag menu. */
  bulkTag(value: string): void {
    const [action, id] = value.split(':');
    if (!id) return;
    this.bulkApply(action === 'remove' ? { removeTagId: id } : { addTagId: id });
  }

  bulkBudget(value: string): void {
    if (value === 'unlink') this.bulkApply({ unlinkBudget: true });
    else if (value) this.bulkApply({ budgetId: value });
  }

  /** One change for every ticked transaction; what the API skipped (a flow that doesn't fit, say) is said too. */
  bulkApply(change: Omit<TransactionBulkUpdateInputDto, 'transactionIds'>): void {
    const ids = [...this.selected()];
    if (ids.length === 0 || this.bulkSaving()) return;
    if (
      !change.categoryId &&
      !change.flow &&
      !change.budgetId &&
      !change.unlinkBudget &&
      !change.addTagId &&
      !change.removeTagId
    )
      return;
    this.bulkSaving.set(true);
    this.transactionRepository.bulkUpdate({ transactionIds: ids, ...change }).subscribe({
      next: ({ updated, notes }) => {
        this.bulkSaving.set(false);
        this.clearSelection();
        this.reload();
        const noun = updated === 1 ? 'transaction' : 'transactions';
        this.toasts.success([`Updated ${updated} ${noun}`, ...notes].join('. '));
      },
      error: (error: unknown) => {
        this.bulkSaving.set(false);
        this.toasts.error(
          conflictDetail(error, validationDetail(error, 'Could not change the transactions.')),
        );
      },
    });
  }
}
