import { TransactionType } from '../enums/transaction-type';
import { AccountType } from '../enums/account-type';
import { Flow } from '../enums/flow';

export type TransactionSortField = 'Date' | 'Description' | 'Amount' | 'Category';
export type SortDirection = 'Ascending' | 'Descending';

export interface TransactionFilterInputDto {
  transactionId?: string;
  transactionType?: TransactionType;
  /** Kinds of account; the list filters by one account with accountId instead. */
  accountType?: AccountType[];
  accountId?: string;
  flow?: Flow;
  startDate?: string;
  endDate?: string;
  description?: string;
  categoryId?: string;
  budgetId?: string;
  /** True: only deleted (hidden) transactions, to restore one. Otherwise only visible ones. */
  hidden?: boolean;
  /** Defaults to Date, Descending (newest first) in the API. */
  sortBy?: TransactionSortField;
  sortDirection?: SortDirection;
  page: number;
  pageSize: number;
}
