import { TransactionType } from '../enums/transaction-type';
import { AccountType } from '../enums/account-type';
import { Category } from '../enums/category';

export interface TransactionFilterInputDto {
  transactionId?: string;
  transactionType?: TransactionType;
  accountType?: AccountType[];
  startDate?: string;
  endDate?: string;
  description?: string;
  category?: Category;
  budgetId?: string;
  page: number;
  pageSize: number;
}
