import { Component, OnInit } from '@angular/core';
import { TransactionRepository } from '../../Repositories/transaction-repository';
import { TransactionFilterInputDto } from '../../Models/Inputs/transaction-filter-input-dto';
import { TransactionOutputDto } from '../../Models/Outputs/transaction-output-dto';
import { PaginatedResult } from '../../Models/Outputs/paginated-result-output-dto';
import { PaginatedContentComponent } from '../paginated-content/paginated-content.component';
import { TransactionFilterComponent } from '../transaction-filter/transaction-filter.component';
import { CommonModule } from '@angular/common';
import { CategoryColorHelper } from '../../Helpers/category-color-helper';
import {BudgetRepository} from '../../Repositories/budget-repository';
import {BudgetOutputDto} from '../../Models/Outputs/budget-output-dto';
import {BudgetFilterInputDto} from '../../Models/Inputs/budget-filter-input-dto';
import {Status} from '../../Models/Enums/status';
import {TransactionLinkForm} from '../transaction-link-form/transaction-link-form/transaction-link-form';
import {BudgetInputDto} from '../../Models/Inputs/budget-input-dto';
import {TransactionLinkingInputDto} from '../../Models/Inputs/transaction-input-dto';

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
    Page: 1,
    PageSize: 10
  };

  constructor(private transactionRepository: TransactionRepository,
              private budgetRepository: BudgetRepository,) {}

  ngOnInit(): void {
    this.loadTransactions();
    this.loadBudgets();
  }

  loadBudgets(): void {
    let filter = {
      Status: Status.Active
    } as BudgetFilterInputDto;
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
    this.filter.Page = page;
    this.loadTransactions();
  }

  onFilterChange(newFilter: TransactionFilterInputDto): void {
    this.filter = { ...newFilter, Page: 1 };
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
