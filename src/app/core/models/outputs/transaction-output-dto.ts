import { Category } from '../enums/category';
import { TransactionType } from '../enums/transaction-type';
import { AccountType } from '../enums/account-type';
import { BudgetOutputDto } from './budget-output-dto';

export interface TransactionOutputDto {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: Category;
  transactionType?: TransactionType;
  account: AccountType;
  budgetId: string;
  budget?: BudgetOutputDto | null;
}
