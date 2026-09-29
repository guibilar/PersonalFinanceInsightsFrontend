import { AccountType } from '../enums/account-type';
import { StatementFormat } from '../enums/statement-format';

/** A new account. The name is unique, ignoring case; the API trims it. */
export interface AccountInputDto {
  name: string;
  type: AccountType;
  /** The layout of the bank's statement files. */
  format: StatementFormat;
}

/** Changing an account: its type can't change. */
export interface AccountUpdateInputDto {
  name: string;
  format: StatementFormat;
}
