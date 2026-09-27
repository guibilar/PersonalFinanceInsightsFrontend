import { Status } from '../enums/status';

export interface BudgetFilterInputDto {
  name?: string;
  description?: string;
  status?: Status;
  page: number;
  pageSize: number;
}
