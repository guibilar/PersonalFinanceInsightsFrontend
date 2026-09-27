import { TransactionType } from '../enums/transaction-type';
import { AccountType } from '../enums/account-type';
import { Category } from '../enums/category';

export type TransactionSortField = 'Date' | 'Description' | 'Amount' | 'Category';
export type SortDirection = 'Ascending' | 'Descending';

export interface TransactionFilterInputDto {
  transactionId?: string;
  transactionType?: TransactionType;
  accountType?: AccountType[];
  startDate?: string;
  endDate?: string;
  description?: string;
  category?: Category;
  budgetId?: string;
  /** Defaults to Date, Descending (newest first) in the API. */
  sortBy?: TransactionSortField;
  sortDirection?: SortDirection;
  page: number;
  pageSize: number;
}
