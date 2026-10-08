import { accountsBehind, attentionItems, statementsReach } from './attention';
import { AccountOutputDto } from '../../core/models/outputs/account-output-dto';
import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { RecurringPaymentDto } from '../../core/models/outputs/insights-output-dto';
import { AccountType } from '../../core/models/enums/account-type';
import { StatementFormat } from '../../core/models/enums/statement-format';
import { Status } from '../../core/models/enums/status';
import { BudgetPeriod } from '../../core/models/enums/budget-period';

// The same cases as the Android app's AttentionTest.
describe('attention', () => {
  const today = new Date(2026, 8, 5);

  function account(
    name: string,
    format = StatementFormat.Cibc,
    last: string | null = null,
    balanceDate: string | null = null,
  ): AccountOutputDto {
    return {
      id: name,
      name,
      type: AccountType.Chequing,
      format,
      transactionCount: last ? 3 : 0,
      lastTransactionDate: last,
      balance: balanceDate ? { id: 'b', date: balanceDate, amount: 100 } : null,
    };
  }

  it('finds an account behind when its statements stop before last month, by transactions or balances', () => {
    const accounts = [
      account('TFSA', StatementFormat.Wealthsimple, '2026-06-16T00:00:00Z', '2026-06-30T00:00:00Z'),
      // A quiet month still brings a balance for its last day.
      account('RRSP', StatementFormat.Wealthsimple, '2026-03-02T00:00:00Z', '2026-08-31T00:00:00Z'),
      account('Chequing', StatementFormat.Cibc, '2026-09-02T00:00:00Z'),
      account('Cash', StatementFormat.Manual, '2026-01-02T00:00:00Z'),
      account('Unused'),
    ];

    expect(accountsBehind(accounts, today).map((a) => a.name)).toEqual(['TFSA']);
    expect(statementsReach(accounts[0])).toBe('2026-06-30T00:00:00Z');
  });

  it('lists budgets over, statements behind, recent price changes and unsorted transactions', () => {
    const budget = {
      id: 'b1',
      name: 'Groceries',
      description: '',
      status: Status.Active,
      period: BudgetPeriod.Monthly,
      categories: [],
      totalAmount: 150,
      totalSpent: 180,
      totalRemaining: -30,
      percentageUsed: 120,
    } as BudgetOutputDto;
    const payment = (
      name: string,
      since: string,
      status: RecurringPaymentDto['status'] = 'Active',
    ) =>
      ({
        name,
        cadence: 'Monthly',
        status,
        amount: 18.99,
        priceChange: { from: 16.49, to: 18.99, since },
      }) as RecurringPaymentDto;

    const items = attentionItems(
      {
        unsorted: 1,
        budgets: [budget],
        recurring: {
          payments: [
            payment('NETFLIX', '2026-08-20T00:00:00Z'),
            payment('OLD GYM', '2026-03-20T00:00:00Z'),
            payment('STOPPED', '2026-08-25T00:00:00Z', 'Stopped'),
          ],
          monthlyTotal: 0,
          yearlyTotal: 0,
        },
        accounts: [account('TFSA', StatementFormat.Wealthsimple, null, '2026-06-30T00:00:00Z')],
      },
      today,
    );

    expect(items.map(({ kind, text }) => ({ kind, text }))).toEqual([
      { kind: 'budget', text: 'Groceries is over its limit (120% used)' },
      { kind: 'statement', text: "TFSA: statements reach Jun 30, 2026. Import last month's" },
      { kind: 'price', text: 'NETFLIX went up from $16.49 to $18.99' },
      {
        kind: 'unsorted',
        text: '1 transaction is in Other because no rule names its merchant',
      },
    ]);
  });

  it('says when nothing was imported for more than a week', () => {
    const imported: AccountOutputDto = {
      ...account('Chequing', StatementFormat.Cibc, '2026-08-26T00:00:00Z'),
      lastImportedAt: '2026-08-27T15:00:00Z',
    };
    const inputs = { unsorted: 0, budgets: [], recurring: null, accounts: [imported] };

    expect(attentionItems(inputs, today).map((i) => i.text)).toEqual([
      'No statements imported in 9 days',
    ]);
    expect(attentionItems(inputs, new Date(2026, 8, 3))).toEqual([]);
  });
});
