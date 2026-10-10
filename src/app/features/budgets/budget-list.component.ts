import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { CategoryRepository } from '../../core/api/category-repository';
import { BudgetRepository } from '../../core/api/budget-repository';
import { BudgetInputDto } from '../../core/models/inputs/budget-input-dto';
import { BudgetFilterInputDto } from '../../core/models/inputs/budget-filter-input-dto';
import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { Status } from '../../core/models/enums/status';
import { BudgetFormComponent } from './budget-form.component';
import { BudgetCriteria, BudgetToolbarComponent } from './budget-toolbar.component';
import { PaginatedContentComponent } from '../../shared/ui/paginated-content/paginated-content.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { conflictDetail } from '../../shared/utils/problem-detail';
import { periodName, periodSuffix } from '../../shared/utils/budget-period';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { keptValueOf, valueOf } from '../../shared/utils/resource-value';
import { DataChangesService } from '../../core/data/data-changes.service';
import { ReportsRepository } from '../../core/api/reports-repository';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

export type BudgetHealth = 'ok' | 'warning' | 'over';

/** Amber from 80% used, red at or over the limit. */
export function budgetHealth(budget: BudgetOutputDto): BudgetHealth {
  if (budget.percentageUsed >= 100) return 'over';
  if (budget.percentageUsed >= 80) return 'warning';
  return 'ok';
}

// A 3-column grid shows 4 full rows.
const PAGE_SIZE = 12;

@Component({
  selector: 'app-budget-list',
  imports: [
    MoneyPipe,
    DecimalPipe,
    BudgetFormComponent,
    BudgetToolbarComponent,
    PaginatedContentComponent,
    ErrorStateComponent,
    IconComponent,
    ModalComponent,
    ConfirmDialogComponent,
    SkeletonComponent,
  ],
  templateUrl: './budget-list.component.html',
  styleUrl: './budget-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetListComponent {
  private readonly budgetRepository = inject(BudgetRepository);
  private readonly categoryRepository = inject(CategoryRepository);
  private readonly toasts = inject(ToastService);
  private readonly reportsRepository = inject(ReportsRepository);

  readonly filter = signal<BudgetFilterInputDto>({ page: 1, pageSize: PAGE_SIZE });
  readonly criteria = computed<BudgetCriteria>(() => ({
    name: this.filter().name,
    status: this.filter().status,
  }));
  readonly hasCriteria = computed(() => !!(this.filter().name || this.filter().status));

  /** undefined: panel closed; null: creating; a budget: editing it. */
  readonly editing = signal<BudgetOutputDto | null | undefined>(undefined);
  readonly deleting = signal<BudgetOutputDto | null>(null);
  readonly saving = signal(false);

  // For the budget form's categories.
  private readonly categoriesResource = rxResource({
    stream: () => this.categoryRepository.getAll(),
  });
  readonly categories = computed(() => valueOf(this.categoriesResource) ?? []);

  /** Where each monthly and yearly budget should end at its usual pace, by id. */
  /** A statement imported from the sidebar loads the budgets and their pace again. */
  private readonly dataChanges = inject(DataChangesService);

  readonly forecast = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.reportsRepository.getForecast(),
  });
  readonly projections = computed(
    () => new Map((valueOf(this.forecast)?.budgets ?? []).map((b) => [b.budgetId, b])),
  );

  readonly budgets = rxResource({
    params: () => ({ filter: this.filter(), version: this.dataChanges.version() }),
    stream: ({ params }) => this.budgetRepository.filter(params.filter),
  });
  /** Kept while another page or filter loads, so the pager (and its focus) stays put. */
  readonly page = keptValueOf(this.budgets);

  protected readonly Status = Status;
  protected readonly health = budgetHealth;
  protected readonly periodName = periodName;
  protected readonly periodSuffix = periodSuffix;
  protected readonly min = Math.min;
  protected readonly abs = Math.abs;

  onCriteriaChange(criteria: BudgetCriteria): void {
    this.filter.set({ ...criteria, page: 1, pageSize: PAGE_SIZE });
  }

  onPageChange(page: number): void {
    this.filter.update((filter) => ({ ...filter, page }));
  }

  onFormSubmit(budget: BudgetInputDto): void {
    if (this.saving()) return;
    const editing = this.editing();
    const request = editing
      ? this.budgetRepository.update(editing.id, budget)
      : this.budgetRepository.create(budget);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(undefined);
        this.budgets.reload();
        this.forecast.reload();
        this.toasts.success(editing ? `Saved “${budget.name}”` : `Created “${budget.name}”`);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.toasts.error(
          conflictDetail(
            error,
            editing ? 'Could not save the budget.' : 'Could not create the budget.',
          ),
        );
      },
    });
  }

  confirmDelete(): void {
    const budget = this.deleting();
    if (!budget) return;
    this.deleting.set(null);
    this.budgetRepository.delete(budget.id).subscribe({
      next: () => {
        this.budgets.reload();
        this.forecast.reload();
        this.toasts.success(`Deleted “${budget.name}”`);
      },
      error: () => this.toasts.error(`Could not delete “${budget.name}”.`),
    });
  }
}
