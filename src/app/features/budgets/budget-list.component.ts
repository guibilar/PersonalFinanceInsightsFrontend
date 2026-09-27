import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BudgetRepository } from '../../core/api/budget-repository';
import { BudgetInputDto } from '../../core/models/inputs/budget-input-dto';
import { BudgetFilterInputDto } from '../../core/models/inputs/budget-filter-input-dto';
import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { PaginatedResult } from '../../core/models/outputs/paginated-result-output-dto';
import { BudgetFormComponent } from './budget-form.component';
import { BudgetFilterComponent } from './budget-filter.component';
import { PaginatedContentComponent } from '../../shared/ui/paginated-content/paginated-content.component';
import { Status } from '../../core/models/enums/status';

@Component({
  selector: 'app-budget-list',
  standalone: true,
  imports: [CommonModule, BudgetFormComponent, BudgetFilterComponent, PaginatedContentComponent],
  templateUrl: './budget-list.component.html',
  styleUrls: ['./budget-list.component.css']
})
export class BudgetListComponent implements OnInit {
  budgets?: PaginatedResult<BudgetOutputDto>;
  editingBudget: BudgetOutputDto | null = null;
  showForm: boolean = false;
  filter: BudgetFilterInputDto = {
    page: 1,
    pageSize: 10
  };

  constructor(private budgetRepository: BudgetRepository) {}

  ngOnInit(): void {
    this.loadBudgets();
  }

  loadBudgets(): void {
    this.budgetRepository.filter(this.filter).subscribe({
      next: (data) => {
        this.budgets = data;
      },
      error: (error) => {
        console.error('Error loading budgets:', error);
      }
    });
  }

  onCreateBudget(): void {
    this.editingBudget = null;
    this.showForm = true;
  }

  onEditBudget(budget: BudgetOutputDto): void {
    this.editingBudget = budget;
    this.showForm = true;
  }

  onDeleteBudget(id: string): void {
    if (confirm('Are you sure you want to delete this budget?')) {
      this.budgetRepository.delete(id).subscribe({
        next: () => {
          this.loadBudgets();
          console.log('Budget deleted successfully');
        },
        error: (error) => {
          console.error('Error deleting budget:', error);
        }
      });
    }
  }

  onPageChange(page: number): void {
    this.filter = { ...this.filter, page: page };
    this.loadBudgets();
  }

  onFilterChange(newFilter: BudgetFilterInputDto): void {
    this.filter = { ...newFilter, page: 1 };
    this.loadBudgets();
  }

  onFormSubmit(budgetDto: BudgetInputDto): void {
    if (this.editingBudget) {
      this.budgetRepository.update(budgetDto.id, budgetDto).subscribe({
        next: () => {
          this.showForm = false;
          this.editingBudget = null;
          this.loadBudgets();
          console.log('Budget updated successfully');
        },
        error: (error) => {
          console.error('Error updating budget:', error);
        }
      });
    } else {
      this.budgetRepository.create(budgetDto).subscribe({
        next: () => {
          this.showForm = false;
          this.loadBudgets();
          console.log('Budget created successfully');
        },
        error: (error) => {
          console.error('Error creating budget:', error);
        }
      });
    }
  }

  onFormCancel(): void {
    this.showForm = false;
    this.editingBudget = null;
  }

  getStatusLabel(status: Status): string {
    return status.toString();
  }

  protected readonly Status = Status;
  protected readonly Math = Math;
}
