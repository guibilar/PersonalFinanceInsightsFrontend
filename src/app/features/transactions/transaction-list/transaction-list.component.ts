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
import { ActivatedRoute, Params, Router } from '@angular/router';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import {
  BreakdownInterval,
  BreakdownPeriodDto,
} from '../../../core/models/outputs/transaction-breakdown-output-dto';
import { ImportSummary, describeImport } from '../statement-import/statement-import.component';
import { DataChangesService } from '../../../core/data/data-changes.service';
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
import { conflictDetail, validationDetail } from '../../../shared/utils/problem-detail';
import { APPLY_RULES_CONFIRMATION } from '../../../shared/utils/category-rules-messages';
import {
  TransactionCriteria,
  TransactionToolbarComponent,
} from '../transaction-toolbar/transaction-toolbar.component';
import { TransactionLinkForm } from '../transaction-link-form/transaction-link-form';
import { TransactionEditForm } from '../transaction-edit-form/transaction-edit-form';
import { TransactionAddForm } from '../transaction-add-form/transaction-add-form';
import {
  CLOSER,
  criteriaFromQuery,
  definedCriteria,
  sameCriteria,
  intervalFromQuery,
  OWN_NAVIGATION,
} from './transaction-list-query';
import { BulkChange, TransactionBulkBar } from '../transaction-bulk-bar/transaction-bulk-bar';
import { StatementImportComponent } from '../statement-import/statement-import.component';
import { TransactionBreakdownComponent } from '../transaction-breakdown/transaction-breakdown.component';
import { valueOf } from '../../../shared/utils/resource-value';
import { TransactionActions } from './transaction-actions';

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
    TransactionBulkBar,
    StatementImportComponent,
    TransactionBreakdownComponent,
    ConfirmDialogComponent,
    ModalComponent,
    SkeletonComponent,
    ErrorStateComponent,
    IconComponent,
  ],
  providers: [TransactionActions],
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
  /** Add, edit, link, delete and restore, with their dialogs. */
  readonly actions = inject(TransactionActions);

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
  readonly showImport = signal(false);
  /** Ticked for a bulk change; cleared when the list shows other transactions. */
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly selectedCount = computed(() => this.selected().size);
  readonly bulkSaving = signal(false);
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
    this.actions.changed.pipe(takeUntilDestroyed()).subscribe(() => this.reload());
    // A statement imported from the sidebar while the list is open: show what it added.
    const changes = inject(DataChangesService).version;
    const seen = changes();
    effect(() => {
      if (changes() !== seen) untracked(() => this.reload());
    });
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
    this.toasts.success(describeImport(result));
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

  /** One change for every ticked transaction; what the API skipped (a flow that doesn't fit, say) is said too. */
  bulkApply(change: BulkChange): void {
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
