import { AccountType } from '../enums/account-type';

/** A new account. The name is unique, ignoring case; the API trims it. */
export interface AccountInputDto {
  name: string;
  type: AccountType;
}

/** Renaming an account: its type can't change. */
export interface AccountRenameInputDto {
  name: string;
}
