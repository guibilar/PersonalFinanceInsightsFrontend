import { Status } from '../enums/status';
import { BudgetPeriod } from '../enums/budget-period';

export interface BudgetOutputDto {
  id: string;
  name: string;
  description: string;
  status: Status;
  period: BudgetPeriod;
  totalAmount: number;
  totalSpent: number;
  totalRemaining: number;
  percentageUsed: number;
}
