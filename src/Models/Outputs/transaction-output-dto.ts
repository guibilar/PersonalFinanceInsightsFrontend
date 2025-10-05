import {Category} from '../Enums/category';
import {TransactionType} from '../Enums/transaction-type';

export interface TransactionOutputDto {
  id: string;
  data: string;
  amount: number;
  description: string;
  category: Category;
  transactionType?: TransactionType;
  account: string;
  budgetId: string;
}
