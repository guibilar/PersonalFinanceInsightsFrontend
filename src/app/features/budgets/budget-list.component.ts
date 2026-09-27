import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { BudgetRepository } from '../../core/api/budget-repository';
import { BudgetInputDto } from '../../core/models/inputs/budget-input-dto';
import { BudgetFilterInputDto } from '../../core/models/inputs/budget-filter-input-dto';
import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { Status } from '../../core/models/enums/status';
import { BudgetFormComponent } from './budget-form.component';
import { BudgetFilterComponent } from './budget-filter.component';
import { PaginatedContentComponent } from '../../shared/ui/paginated-content/paginated-content.component';
import { LoaderComponent } from '../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';

@Component({
  selector: 'app-budget-list',
  imports: [
    CurrencyPipe,
    BudgetFormComponent,
    BudgetFilterComponent,
    PaginatedContentComponent,
    LoaderComponent,
    ErrorStateComponent,
  ],
  templateUrl: './budget-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetListComponent {
  private readonly budgetRepository = inject(BudgetRepository);

  readonly filter = signal<BudgetFilterInputDto>({ page: 1, pageSize: 10 });
  readonly showForm = signal(false);
  readonly editingBudget = signal<BudgetOutputDto | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly budgets = rxResource({
    params: () => this.filter(),
    stream: ({ params }) => this.budgetRepository.filter(params),
  });

  protected readonly Status = Status;
  protected readonly Math = Math;

  onCreateBudget(): void {
    this.editingBudget.set(null);
    this.showForm.set(true);
  }

  onEditBudget(budget: BudgetOutputDto): void {
    this.editingBudget.set(budget);
    this.showForm.set(true);
  }

  onDeleteBudget(id: string): void {
    if (!confirm('Are you sure you want to delete this budget?')) {
      return;
    }
    this.budgetRepository.delete(id).subscribe({
      next: () => this.budgets.reload(),
      error: () => this.actionError.set('Could not delete the budget.'),
    });
  }

  onPageChange(page: number): void {
    this.filter.update((filter) => ({ ...filter, page }));
  }

  onFilterChange(newFilter: BudgetFilterInputDto): void {
    this.filter.set({ ...newFilter, page: 1 });
  }

  onFormSubmit(budgetDto: BudgetInputDto): void {
    const editing = this.editingBudget();
    const request = editing
      ? this.budgetRepository.update(editing.id, budgetDto)
      : this.budgetRepository.create(budgetDto);

    request.subscribe({
      next: () => {
        this.onFormCancel();
        this.budgets.reload();
      },
      error: () =>
        this.actionError.set(
          editing ? 'Could not update the budget.' : 'Could not create the budget.',
        ),
    });
  }

  onFormCancel(): void {
    this.showForm.set(false);
    this.editingBudget.set(null);
  }
}
