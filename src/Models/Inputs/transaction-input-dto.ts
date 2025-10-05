import {Category} from '../Enums/category';
import {TransactionType} from '../Enums/transaction-type';
import {AccountType} from '../Enums/account-type';

export interface TransactionInputDto {
  Datetime: string;
  Amount: number;
  Description: string;
  Category: Category;
  TransactionType: TransactionType;
  Account: AccountType;
  BudgetId: string;
}
