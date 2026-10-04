import { BudgetPeriod } from '../core/models/enums/budget-period';
import {
  RecurringReportDto,
  ReviewReportDto,
  SpendingForecastDto,
  UncategorisedReportDto,
} from '../core/models/outputs/insights-output-dto';
import { TEST_CATEGORIES } from './test-categories';

/** A forecast with nothing in it: no spending, no history, no budgets. */
export const EMPTY_FORECAST: SpendingForecastDto = {
  month: 'October 2026',
  daysInMonth: 31,
  daysLeft: 16,
  spent: 0,
  projected: 0,
  usual: null,
  usualMonths: 0,
  dailyRate: 0,
  upcoming: [],
  budgets: [],
};

/** Mid-October: $55 spent, the rent still due on the 20th, $10 a day as usual, a groceries budget at 50%. */
export const TEST_FORECAST: SpendingForecastDto = {
  ...EMPTY_FORECAST,
  spent: 55,
  projected: 1215,
  usual: 1321.67,
  usualMonths: 3,
  dailyRate: 10,
  upcoming: [{ name: 'LANDLORD', amount: 1000, date: '2026-10-20T00:00:00Z' }],
  budgets: [
    {
      budgetId: 'b1',
      name: 'Food',
      period: BudgetPeriod.Monthly,
      amount: 400,
      spent: 40,
      projected: 460,
      projectedPercentage: 115,
    },
  ],
};

export const EMPTY_UNCATEGORISED: UncategorisedReportDto = { merchants: [], transactionCount: 0 };

export const TEST_UNCATEGORISED: UncategorisedReportDto = {
  transactionCount: 4,
  merchants: [
    {
      keyword: 'CORNER STORE',
      count: 3,
      spending: 15,
      examples: ['SQ *CORNER STORE #12 TORONTO', 'CORNER STORE 99'],
      lastDate: '2026-10-09T00:00:00Z',
    },
    {
      keyword: 'MYSTERY SHOP',
      count: 1,
      spending: 20,
      examples: ['MYSTERY SHOP'],
      lastDate: '2026-10-02T00:00:00Z',
    },
  ],
};

export const TEST_RECURRING: RecurringReportDto = {
  monthlyTotal: 1018.99,
  yearlyTotal: 12227.88,
  payments: [
    {
      name: 'LANDLORD',
      cadence: 'Monthly',
      status: 'Active',
      amount: 1000,
      variableAmount: false,
      firstDate: '2026-07-20T00:00:00Z',
      lastDate: '2026-09-20T00:00:00Z',
      lastAmount: 1000,
      nextDate: '2026-10-20T00:00:00Z',
      count: 3,
      monthlyCost: 1000,
      yearlyCost: 12000,
      category: TEST_CATEGORIES.rent,
      priceChange: null,
    },
    {
      name: 'NETFLIX',
      cadence: 'Monthly',
      status: 'Active',
      amount: 18.99,
      variableAmount: false,
      firstDate: '2026-06-05T00:00:00Z',
      lastDate: '2026-10-05T00:00:00Z',
      lastAmount: 18.99,
      nextDate: '2026-11-05T00:00:00Z',
      count: 5,
      monthlyCost: 18.99,
      yearlyCost: 227.88,
      category: TEST_CATEGORIES.shopping,
      priceChange: { from: 16.49, to: 18.99, since: '2026-10-05T00:00:00Z' },
    },
    {
      name: 'GYM',
      cadence: 'Monthly',
      status: 'Stopped',
      amount: 50,
      variableAmount: false,
      firstDate: '2026-01-03T00:00:00Z',
      lastDate: '2026-05-03T00:00:00Z',
      lastAmount: 50,
      nextDate: '2026-06-03T00:00:00Z',
      count: 5,
      monthlyCost: 50,
      yearlyCost: 600,
      category: null,
      priceChange: null,
    },
  ],
};

/** September 2026 against August. */
export const TEST_REVIEW: ReviewReportDto = {
  label: 'September 2026',
  year: 2026,
  month: 9,
  start: '2026-09-01T00:00:00Z',
  end: '2026-09-30T00:00:00Z',
  complete: true,
  previousLabel: 'August 2026',
  spending: 1315,
  previousSpending: 1325,
  income: 3000,
  previousIncome: 0,
  purchases: 4,
  noSpendDays: 26,
  categories: [
    { category: TEST_CATEGORIES.rent, spending: 1000, previousSpending: 1000 },
    { category: TEST_CATEGORIES.groceries, spending: 300, previousSpending: 310 },
    { category: TEST_CATEGORIES.dining, spending: 15, previousSpending: 0 },
  ],
  topMerchants: [
    { name: 'LANDLORD', count: 1, spending: 1000 },
    { name: 'SAFEWAY', count: 1, spending: 200 },
  ],
  biggestPurchase: {
    description: 'LANDLORD',
    amount: 1000,
    date: '2026-09-20T00:00:00Z',
    category: TEST_CATEGORIES.rent,
  },
  months: [],
  recurringCount: 2,
  recurringMonthlyTotal: 1018.99,
  earliest: '2026-07',
};
