import { Status } from '../Enums/status';

export interface BudgetOutputDto {
  id: string;
  name: string;
  description: string;
  status: Status;
  totalAmount: number;
  totalSpent: number;
  totalRemaining: number;
  percentageUsed: number;
}
