import { Component, OnInit } from '@angular/core';
import { TransactionRepository } from '../../Repositories/transaction-repository';
import { TransactionFilterInputDto } from '../../Models/Inputs/transaction-filter-input-dto';
import { TransactionOutputDto } from '../../Models/Outputs/transaction-output-dto';
import { PaginatedResult } from '../../Models/Outputs/paginated-result-output-dto';
import { PaginatedContentComponent } from '../paginated-content/paginated-content.component';
import { TransactionFilterComponent } from '../transaction-filter/transaction-filter.component';
import { CommonModule } from '@angular/common';
import { CategoryColorHelper } from '../../Helpers/category-color-helper';

@Component({
  selector: 'app-transaction-list',
  templateUrl: './transaction-list.component.html',
  imports: [
    PaginatedContentComponent,
    TransactionFilterComponent,
    CommonModule
  ],
  styleUrls: ['./transaction-list.component.css']
})
export class TransactionListComponent implements OnInit {
  transactions?: PaginatedResult<TransactionOutputDto>;
  filter: TransactionFilterInputDto = {
    Page: 1,
    PageSize: 10
  };

  constructor(private transactionRepository: TransactionRepository) {}

  ngOnInit(): void {
    this.loadTransactions();
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
}
