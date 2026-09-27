import { Component, OnInit } from '@angular/core';
import { TransactionRepository } from '../../../core/api/transaction-repository';
import { TransactionFilterInputDto } from '../../../core/models/inputs/transaction-filter-input-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { PaginatedResult } from '../../../core/models/outputs/paginated-result-output-dto';
import { PaginatedContentComponent } from '../../../shared/ui/paginated-content/paginated-content.component';
import { TransactionFilterComponent } from '../transaction-filter/transaction-filter.component';
import { CommonModule } from '@angular/common';
import { CategoryColorHelper } from '../../../shared/utils/category-color-helper';
import {BudgetRepository} from '../../../core/api/budget-repository';
import {BudgetOutputDto} from '../../../core/models/outputs/budget-output-dto';
import {BudgetFilterInputDto} from '../../../core/models/inputs/budget-filter-input-dto';
import {Status} from '../../../core/models/enums/status';
import {TransactionLinkForm} from '../transaction-link-form/transaction-link-form';
import {TransactionLinkingInputDto} from '../../../core/models/inputs/transaction-linking-input-dto';

@Component({
  selector: 'app-transaction-list',
  templateUrl: './transaction-list.component.html',
  imports: [
    PaginatedContentComponent,
    TransactionFilterComponent,
    CommonModule,
    TransactionLinkForm
  ],
  styleUrls: ['./transaction-list.component.css']
})
export class TransactionListComponent implements OnInit {
  showForm: boolean = false;
  linkingTransaction: TransactionOutputDto | null = null;
  transactions?: PaginatedResult<TransactionOutputDto>;
  budgets?: BudgetOutputDto[] | undefined = [];
  filter: TransactionFilterInputDto = {
    page: 1,
    pageSize: 10
  };

  constructor(private transactionRepository: TransactionRepository,
              private budgetRepository: BudgetRepository,) {}

  ngOnInit(): void {
    this.loadTransactions();
    this.loadBudgets();
  }

  loadBudgets(): void {
    // Link dropdown needs every active budget, not just the first page.
    const filter: BudgetFilterInputDto = {
      status: Status.Active,
      page: 1,
      pageSize: 1000
    };
    this.budgetRepository.filter(filter).subscribe({
      next: (data) => {
        this.budgets = data.items;
      },
      error: (error) => {
        console.error('Error loading budgets:', error);
      }
    });
  }

  onLinkingTransaction(transaction: TransactionOutputDto): void {
    this.linkingTransaction = transaction;
    this.showForm = true;
  }

  loadTransactions(): void {
    this.transactionRepository.filter(this.filter).subscribe({
      next: (data) => {
        this.transactions = data;
      },
      error: (error) => {
        console.error('Error loading transactions:', error);
      }
    });
  }

  onPageChange(page: number): void {
    this.filter = { ...this.filter, page: page };
    this.loadTransactions();
  }

  onFilterChange(newFilter: TransactionFilterInputDto): void {
    this.filter = { ...newFilter, page: 1 };
    this.loadTransactions();
  }

  getCategoryColor(category: string): string {
    return CategoryColorHelper.getColor(category);
  }

  onFormSubmit(transactionLinkingInputDto: TransactionLinkingInputDto): void {
    if (this.linkingTransaction) {
      this.transactionRepository.linkTransaction(transactionLinkingInputDto).subscribe({
        next: () => {
          this.showForm = false;
          this.linkingTransaction = null;
          this.loadTransactions();
          console.log('Transaction linked successfully');
        },
        error: (error) => {
          console.error('Error linking transaction:', error);
        }
      });
    }
  }

  onUnlinkSubmit(id: string): void {
      this.transactionRepository.unlinkTransaction(id).subscribe({
        next: () => {
          this.loadTransactions();
          console.log('Transaction unlinked successfully');
        },
        error: (error) => {
          console.error('Error unlinked transaction:', error);
        }
      });
  }

  onFormCancel(): void {
    this.showForm = false;
    this.linkingTransaction = null;
  }
}
