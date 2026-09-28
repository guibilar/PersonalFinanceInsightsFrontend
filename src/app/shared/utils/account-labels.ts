import { AccountType } from '../../core/models/enums/account-type';
import { AccountOutputDto } from '../../core/models/outputs/account-output-dto';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  [AccountType.Chequing]: 'Chequing',
  [AccountType.Savings]: 'Savings',
  [AccountType.CreditCard]: 'Credit card',
};

/** "Visa · Credit card": the name, and the kind of account it is. */
export function accountLabel(account: Pick<AccountOutputDto, 'name' | 'type'>): string {
  return `${account.name} · ${ACCOUNT_TYPE_LABELS[account.type]}`;
}
