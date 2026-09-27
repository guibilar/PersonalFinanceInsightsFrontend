import { Status } from '../enums/status';

export interface BudgetInputDto {
  id: string;
  name: string;
  description: string;
  amount: number;
  status: Status;
}
