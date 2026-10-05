import { AccountType } from '../enums/account-type';
import { RegisteredPlan } from '../enums/registered-plan';
import { StatementFormat } from '../enums/statement-format';

/** Changing an account: its type can't change. Plan and room are left as they are when omitted. */
export interface AccountUpdateInputDto {
  name: string;
  format: StatementFormat;
  /** Savings and investment accounts only; None clears it and its room. */
  plan?: RegisteredPlan;
  /** The plan's room for contributionRoomYear (this year when omitted). */
  contributionRoom?: number;
  contributionRoomYear?: number;
}

/** A new account. The name is unique, ignoring case; the API trims it. */
export interface AccountInputDto extends AccountUpdateInputDto {
  type: AccountType;
}

/** An account's balance at the end of a day; one per day, so another for the day replaces it. */
export interface AccountBalanceInputDto {
  /** yyyy-MM-dd, not in the future. */
  date: string;
  /** For a card, what it owes; otherwise what it holds. */
  amount: number;
}
