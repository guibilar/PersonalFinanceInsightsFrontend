import { AccountType } from '../enums/account-type';
import { RegisteredPlan } from '../enums/registered-plan';

export interface NetWorthAccountDto {
  id: string;
  name: string;
  type: AccountType;
  plan: RegisteredPlan;
  /** Today's balance (for a card, what it owes); null until a balance is entered. */
  balance: number | null;
  /** The day of the latest balance entered. */
  balanceDate: string | null;
  /** Transactions since balanceDate moved it (an investment's market value since isn't in it). */
  movedSince: boolean;
  isLiability: boolean;
}

export interface NetWorthMonthDto {
  /** "Sep 2026". */
  month: string;
  /** The month's last day, or today for the current month. */
  date: string;
  assets: number;
  liabilities: number;
  netWorth: number;
  /** Fewer than today's means an account's history starts later. */
  accountsCounted: number;
}

/** What everything is worth today and at each of the last twelve month ends. */
export interface NetWorthReportDto {
  assets: number;
  /** What the cards owe, positive. */
  liabilities: number;
  netWorth: number;
  accounts: NetWorthAccountDto[];
  /** Oldest first; months nothing is known for are left out. */
  months: NetWorthMonthDto[];
}
