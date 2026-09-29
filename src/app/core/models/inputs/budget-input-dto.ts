import { Status } from '../enums/status';
import { BudgetPeriod } from '../enums/budget-period';

export interface BudgetInputDto {
  id: string;
  name: string;
  description: string;
  amount: number;
  status: Status;
  period: BudgetPeriod;
  /** Monthly budgets only: this month's spending in these categories counts without linking. */
  categoryIds: string[];
}
