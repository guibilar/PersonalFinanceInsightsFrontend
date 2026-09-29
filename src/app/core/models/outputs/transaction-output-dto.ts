import { CategoryReference } from './category-output-dto';
import { TransactionType } from '../enums/transaction-type';
import { AccountType } from '../enums/account-type';
import { Flow } from '../enums/flow';
import { BudgetOutputDto } from './budget-output-dto';

export interface TransactionOutputDto {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: CategoryReference;
  /** Picked by hand: re-applying the category rules leaves it alone. */
  categoryLocked: boolean;
  /** Deleted: kept only so re-importing its statement doesn't add it back. */
  hidden?: boolean;
  transactionType?: TransactionType;
  accountId: string;
  accountName: string;
  accountType: AccountType;
  /** What it counts as in the reports. */
  flow: Flow;
  /** Picked by hand: re-applying the flow rules leaves it alone. */
  flowLocked: boolean;
  budgetId: string;
  budget?: BudgetOutputDto | null;
}
