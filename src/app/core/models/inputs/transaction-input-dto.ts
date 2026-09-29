import { Category } from '../enums/category';
import { Flow } from '../enums/flow';
import { TransactionType } from '../enums/transaction-type';

/** A transaction entered by hand, for an account without statement files. */
export interface TransactionInputDto {
  /** The calendar date, `yyyy-MM-dd`. */
  date: string;
  description: string;
  /** Always positive; `transactionType` says which way the money moved. */
  amount: number;
  transactionType: TransactionType;
  accountId: string;
  /** Omitted: the category rules decide. Given: kept when the rules are re-applied. */
  category?: Category;
  /** Omitted: the flow rules decide. Given: kept when the rules are re-applied. */
  flow?: Flow;
  /** Add it although an identical transaction exists (the API answers 409 otherwise). */
  allowDuplicate?: boolean;
}
