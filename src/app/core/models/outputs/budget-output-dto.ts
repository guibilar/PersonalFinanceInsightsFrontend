import { Status } from '../enums/status';
import { BudgetPeriod } from '../enums/budget-period';
import { CategoryReference } from './category-output-dto';

export interface BudgetOutputDto {
  id: string;
  name: string;
  description: string;
  status: Status;
  period: BudgetPeriod;
  /** Counted by themselves (monthly budgets only): this month's spending in them, with no linking. */
  categories: CategoryReference[];
  totalAmount: number;
  totalSpent: number;
  totalRemaining: number;
  percentageUsed: number;
}
