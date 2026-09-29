import { Status } from '../enums/status';
import { BudgetPeriod } from '../enums/budget-period';
import { Category } from '../enums/category';

export interface BudgetOutputDto {
  id: string;
  name: string;
  description: string;
  status: Status;
  period: BudgetPeriod;
  /** Counted by themselves (monthly budgets only): this month's spending in them, with no linking. */
  categories: Category[];
  totalAmount: number;
  totalSpent: number;
  totalRemaining: number;
  percentageUsed: number;
}
