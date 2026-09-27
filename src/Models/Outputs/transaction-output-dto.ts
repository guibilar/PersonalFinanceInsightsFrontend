import {Category} from '../Enums/category';
import {TransactionType} from '../Enums/transaction-type';
import {BudgetOutputDto} from './budget-output-dto';

export interface TransactionOutputDto {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: Category;
  transactionType?: TransactionType;
  account: string;
  budgetId: string;
  budget?: BudgetOutputDto | null;
}
