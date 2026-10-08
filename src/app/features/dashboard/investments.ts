import { AccountOutputDto } from '../../core/models/outputs/account-output-dto';
import { AccountType } from '../../core/models/enums/account-type';
import { RegisteredPlan } from '../../core/models/enums/registered-plan';

/** An investment or registered account on the dashboard: what it holds, and its plan's room this year. */
export interface InvestmentRow {
  id: string;
  name: string;
  plan: RegisteredPlan;
  balance: number | null;
  balanceDate: string | null;
  depositedThisYear: number;
  roomLeft: number | null;
}

/** Investment accounts, and savings held in a registered plan, by balance. */
export function investments(accounts: AccountOutputDto[]): InvestmentRow[] {
  return accounts
    .filter(
      (a) =>
        a.type === AccountType.Investment ||
        (a.plan !== undefined && a.plan !== RegisteredPlan.None),
    )
    .map((a) => ({
      id: a.id,
      name: a.name,
      plan: a.plan ?? RegisteredPlan.None,
      balance: a.balance?.amount ?? null,
      balanceDate: a.balance?.date ?? null,
      depositedThisYear: a.depositedThisYear ?? 0,
      roomLeft: a.roomLeft ?? null,
    }))
    .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
}
