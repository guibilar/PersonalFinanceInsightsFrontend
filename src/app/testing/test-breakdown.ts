import {
  BreakdownPeriodDto,
  TransactionBreakdownOutputDto,
} from '../core/models/outputs/transaction-breakdown-output-dto';

function period(label: string, start: string, end: string, spending: number, cumulative: number) {
  return {
    start: `${start}T00:00:00Z`,
    end: `${end}T00:00:00Z`,
    label,
    count: spending > 0 ? 2 : 0,
    spending,
    income: 0,
    cumulativeSpending: cumulative,
    cumulativeIncome: 0,
  } satisfies BreakdownPeriodDto;
}

/** Three months at a grocery chain, as the API gives them: an empty August, and September still running. */
export const TEST_BREAKDOWN: TransactionBreakdownOutputDto = {
  interval: 'Month',
  count: 6,
  spending: 190,
  refunds: 10,
  income: 0,
  averageSpending: 60,
  averageIncome: 0,
  averagedPeriods: 2,
  periods: [
    period('Jul 2026', '2026-07-01', '2026-07-31', 120, 120),
    period('Aug 2026', '2026-08-01', '2026-08-31', 0, 120),
    period('Sep 2026', '2026-09-01', '2026-09-30', 70, 190),
  ],
  topMerchants: [
    { name: 'NO FRILLS', count: 4, spending: 150 },
    { name: 'SAFEWAY', count: 2, spending: 40 },
  ],
  merchantCount: 2,
};
