import { Flow } from '../enums/flow';
import { BreakdownInterval } from '../outputs/transaction-breakdown-output-dto';

/** The transaction list's criteria, and how long each period is. */
export interface TransactionBreakdownInputDto {
  description?: string;
  categoryId?: string;
  accountId?: string;
  flow?: Flow;
  /** Inclusive, `yyyy-MM-dd`. */
  startDate?: string;
  /** Inclusive, `yyyy-MM-dd`. */
  endDate?: string;
  interval: BreakdownInterval;
}
