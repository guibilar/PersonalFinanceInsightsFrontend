import { AccountType } from '../enums/account-type';

export interface AccountOutputDto {
  id: string;
  name: string;
  type: AccountType;
  /** Includes deleted (hidden) transactions: only an account with none can be deleted. */
  transactionCount: number;
}
