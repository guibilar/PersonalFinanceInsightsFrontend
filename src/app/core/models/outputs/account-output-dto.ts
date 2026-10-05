import { AccountType } from '../enums/account-type';
import { RegisteredPlan } from '../enums/registered-plan';
import { StatementFormat } from '../enums/statement-format';

/** A balance entered for an account: what it held (for a card, owed) at the end of a day. */
export interface AccountBalanceOutputDto {
  id: string;
  /** The calendar day, at midnight UTC. */
  date: string;
  amount: number;
}

export interface AccountOutputDto {
  id: string;
  name: string;
  type: AccountType;
  format: StatementFormat;
  /** Includes deleted (hidden) transactions: only an account with none can be deleted. */
  transactionCount: number;
  /** Savings and investment accounts only; None otherwise. Older APIs leave it out. */
  plan?: RegisteredPlan;
  /** The plan's contribution room for contributionRoomYear, as entered. */
  contributionRoom?: number | null;
  contributionRoomYear?: number | null;
  /** This year's transfers in: for a registered plan, its contributions. */
  depositedThisYear?: number;
  /** This year's transfers out: for a TFSA, room again next January. */
  withdrawnThisYear?: number;
  /** This year's room less this year's deposits; null until this year's room is entered. */
  roomLeft?: number | null;
  /** The latest balance entered. */
  balance?: AccountBalanceOutputDto | null;
}
