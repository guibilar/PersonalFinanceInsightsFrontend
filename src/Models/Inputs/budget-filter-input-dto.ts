import { Status } from '../Enums/status';

export interface BudgetFilterInputDto {
  Name?: string;
  Description?: string;
  Status?: Status;
  Page: number;
  PageSize: number;
}
