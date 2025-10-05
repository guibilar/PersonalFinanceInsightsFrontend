import {Status} from '../Enums/status';

export interface BudgetInputDto {
  Id: string;
  Name: string;
  Description: string;
  Status: Status
}

