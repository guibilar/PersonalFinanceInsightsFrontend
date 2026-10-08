import { investments } from './investments';
import { AccountOutputDto } from '../../core/models/outputs/account-output-dto';
import { AccountType } from '../../core/models/enums/account-type';
import { RegisteredPlan } from '../../core/models/enums/registered-plan';
import { StatementFormat } from '../../core/models/enums/statement-format';

describe('investments', () => {
  it('lists investment and registered accounts by balance, with this year’s room', () => {
    const tfsa: AccountOutputDto = {
      id: 'a1',
      name: 'TFSA',
      type: AccountType.Investment,
      format: StatementFormat.Wealthsimple,
      transactionCount: 3,
      plan: RegisteredPlan.Tfsa,
      depositedThisYear: 5300,
      roomLeft: 1700,
      balance: { id: 'b1', date: '2026-08-31T00:00:00Z', amount: 4380.73 },
    };
    const brokerage: AccountOutputDto = {
      id: 'a2',
      name: 'Brokerage',
      type: AccountType.Investment,
      format: StatementFormat.Manual,
      transactionCount: 0,
    };
    const chequing: AccountOutputDto = {
      id: 'a3',
      name: 'Chequing',
      type: AccountType.Chequing,
      format: StatementFormat.Cibc,
      transactionCount: 3,
    };

    const rows = investments([brokerage, chequing, tfsa]);

    expect(rows.map((r) => r.name)).toEqual(['TFSA', 'Brokerage']);
    expect(rows[0]).toEqual({
      id: 'a1',
      name: 'TFSA',
      plan: RegisteredPlan.Tfsa,
      balance: 4380.73,
      balanceDate: '2026-08-31T00:00:00Z',
      depositedThisYear: 5300,
      roomLeft: 1700,
    });
    expect(rows[1]).toEqual(
      expect.objectContaining({ balance: null, depositedThisYear: 0, roomLeft: null }),
    );
  });
});
