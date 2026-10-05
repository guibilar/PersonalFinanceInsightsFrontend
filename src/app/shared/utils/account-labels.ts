import { AccountType } from '../../core/models/enums/account-type';
import { RegisteredPlan } from '../../core/models/enums/registered-plan';
import { StatementFormat } from '../../core/models/enums/statement-format';
import { AccountOutputDto } from '../../core/models/outputs/account-output-dto';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  [AccountType.Chequing]: 'Chequing',
  [AccountType.Savings]: 'Savings',
  [AccountType.CreditCard]: 'Credit card',
  [AccountType.Investment]: 'Investment',
};

export const PLAN_LABELS: Record<RegisteredPlan, string> = {
  [RegisteredPlan.None]: 'Not registered',
  [RegisteredPlan.Tfsa]: 'TFSA',
  [RegisteredPlan.Rrsp]: 'RRSP',
  [RegisteredPlan.Fhsa]: 'FHSA',
};

/** Savings and investments can be held in a registered plan. */
export function holdsSavings(type: AccountType): boolean {
  return type === AccountType.Savings || type === AccountType.Investment;
}

export const STATEMENT_FORMAT_LABELS: Record<StatementFormat, string> = {
  [StatementFormat.Cibc]: 'CIBC',
  [StatementFormat.Neo]: 'Neo Financial',
  [StatementFormat.Manual]: 'No files (add by hand)',
};

/** "Visa · Credit card": the name, and the kind of account it is. */
export function accountLabel(account: Pick<AccountOutputDto, 'name' | 'type'>): string {
  return `${account.name} · ${ACCOUNT_TYPE_LABELS[account.type]}`;
}
