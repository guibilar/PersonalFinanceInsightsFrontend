import { AccountType } from '../enums/account-type';
import { StatementFormat } from '../enums/statement-format';

export interface AccountOutputDto {
  id: string;
  name: string;
  type: AccountType;
  format: StatementFormat;
  /** Includes deleted (hidden) transactions: only an account with none can be deleted. */
  transactionCount: number;
}
