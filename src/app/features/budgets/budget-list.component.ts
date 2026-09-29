import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { BudgetRepository } from '../../core/api/budget-repository';
import { BudgetInputDto } from '../../core/models/inputs/budget-input-dto';
import { BudgetFilterInputDto } from '../../core/models/inputs/budget-filter-input-dto';
import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { Status } from '../../core/models/enums/status';
import { BudgetPeriod } from '../../core/models/enums/budget-period';
import { BudgetFormComponent } from './budget-form.component';
import { BudgetCriteria, BudgetToolbarComponent } from './budget-toolbar.component';
import { PaginatedContentComponent } from '../../shared/ui/paginated-content/paginated-content.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { conflictDetail } from '../../shared/utils/problem-detail';
import { ToastService } from '../../shared/ui/toast/toast.service';

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
    CurrencyPipe,
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
  private readonly toasts = inject(ToastService);

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

  readonly budgets = rxResource({
    params: () => this.filter(),
    stream: ({ params }) => this.budgetRepository.filter(params),
  });

  protected readonly Status = Status;
  protected readonly BudgetPeriod = BudgetPeriod;
  protected readonly health = budgetHealth;
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
        this.toasts.success(`Deleted “${budget.name}”`);
      },
      error: () => this.toasts.error(`Could not delete “${budget.name}”.`),
    });
  }
}
