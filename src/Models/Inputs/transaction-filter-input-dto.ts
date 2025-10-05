import {TransactionType} from '../Enums/transaction-type';
import {AccountType} from '../Enums/account-type';
import {Category} from '../Enums/category';

export interface TransactionFilterInputDto {
  TransactionId?: string;
  TransactionType?: TransactionType;
  AccountType?: AccountType[];
  StartDate?: string;
  EndDate?: string;
  Description?: string;
  Category?: Category;
  BudgetId?: string;
  Page: number;
  PageSize: number;
}

