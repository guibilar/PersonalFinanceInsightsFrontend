import { Status } from '../Enums/status';

export interface BudgetOutputDto {
  Id: string;
  Name: string;
  Description: string;
  Status: Status;
}
