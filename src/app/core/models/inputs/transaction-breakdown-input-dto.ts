import { Flow } from '../enums/flow';
import { BreakdownInterval } from '../outputs/transaction-breakdown-output-dto';

/** The transaction list's criteria, without its paging and sorting. */
export interface TransactionCriteriaInputDto {
  description?: string;
  categoryId?: string;
  accountId?: string;
  flow?: Flow;
  /** Inclusive, `yyyy-MM-dd`. */
  startDate?: string;
  /** Inclusive, `yyyy-MM-dd`. */
  endDate?: string;
}

/** The transaction list's criteria, and how long each period is. */
export interface TransactionBreakdownInputDto extends TransactionCriteriaInputDto {
  interval: BreakdownInterval;
}

/** The transaction list's criteria, and which page of the merchants they spent at. */
export interface MerchantsInputDto extends TransactionCriteriaInputDto {
  page: number;
  pageSize: number;
}
