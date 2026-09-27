import { Status } from '../enums/status';
import { BudgetPeriod } from '../enums/budget-period';

export interface BudgetInputDto {
  id: string;
  name: string;
  description: string;
  amount: number;
  status: Status;
  period: BudgetPeriod;
}
