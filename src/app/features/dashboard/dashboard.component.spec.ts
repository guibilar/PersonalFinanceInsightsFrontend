import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { CategorizedReportOutputDto } from '../../core/models/outputs/categorized-report-output-dto';
import { CashFlowReportOutputDto } from '../../core/models/outputs/cash-flow-report-output-dto';
import { categoryRefs } from '../../testing/test-categories';
import {
  SpendingForecastDto,
  UncategorisedReportDto,
} from '../../core/models/outputs/insights-output-dto';
import { NetWorthReportDto } from '../../core/models/outputs/net-worth-output-dto';
import { AccountOutputDto } from '../../core/models/outputs/account-output-dto';
import {
  RecurringPaymentDto,
  RecurringReportDto,
} from '../../core/models/outputs/insights-output-dto';
import { AccountType } from '../../core/models/enums/account-type';
import { StatementFormat } from '../../core/models/enums/statement-format';
import { RegisteredPlan } from '../../core/models/enums/registered-plan';
import {
  EMPTY_FORECAST,
  EMPTY_UNCATEGORISED,
  TEST_FORECAST,
  TEST_UNCATEGORISED,
} from '../../testing/test-insights';

const emptyPage = {
  items: [],
  page: 1,
  pageSize: 6,
  totalCount: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

const EMPTY_NET_WORTH: NetWorthReportDto = {
  assets: 0,
  liabilities: 0,
  netWorth: 0,
  accounts: [],
  months: [],
};

const TEST_NET_WORTH: NetWorthReportDto = {
  assets: 16000,
  liabilities: 1000,
  netWorth: 15000,
  accounts: [],
  months: [
    {
      month: 'Aug 2026',
      date: '2026-08-31',
      assets: 15200,
      liabilities: 700,
      netWorth: 14500,
      accountsCounted: 2,
    },
    {
      month: 'Sep 2026',
      date: '2026-09-05',
      assets: 16000,
      liabilities: 1000,
      netWorth: 15000,
      accountsCounted: 2,
    },
  ],
};

const EMPTY_RECURRING: RecurringReportDto = { payments: [], monthlyTotal: 0, yearlyTotal: 0 };

const TEST_RECURRING_PAYMENT: RecurringPaymentDto = {
  name: 'SPOTIFY',
  cadence: 'Monthly',
  status: 'Active',
  amount: 12.99,
  variableAmount: false,
  firstDate: '2025-01-10',
  lastDate: '2026-08-20',
  lastAmount: 12.99,
  nextDate: '2026-09-20',
  count: 20,
  monthlyCost: 12.99,
  yearlyCost: 155.88,
  category: null,
  priceChange: null,
};

const emptyCashFlow: CashFlowReportOutputDto = {
  months: [],
  averageMonthlyIncome: 0,
  averageMonthlySpending: 0,
  averageMonthlyNet: 0,
  averageMonthlySavingsChange: 0,
  averagedMonths: 0,
  averagesIncludeCurrentMonth: false,
};

function currentMonth(
  spent: number,
  previousMonthToDateTotal?: number,
): CategorizedReportOutputDto {
  return {
    categories: categoryRefs('Dining'),
    averageMonthlyTotal: spent,
    monthlyData: [{ month: 'Sep 2026', total: spent, categoryValues: { Dining: spent } }],
    previousMonthToDateTotal,
  };
}

describe('DashboardComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    // Only the clock: the requests still resolve on their own.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 5, 12));
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Answered in load(); a test that loads the reports itself leaves these to here.
    http.match('/api/Reports/forecast').forEach((r) => r.flush(EMPTY_FORECAST));
    http.match('/api/Reports/uncategorised').forEach((r) => r.flush(EMPTY_UNCATEGORISED));
    http.match('/api/Reports/net-worth').forEach((r) => r.flush(EMPTY_NET_WORTH));
    http.match('/api/Accounts').forEach((r) => r.flush([]));
    http.match('/api/Reports/recurring').forEach((r) => r.flush(EMPTY_RECURRING));
    http.verify();
    vi.useRealTimers();
  });

  async function load(
    month: CategorizedReportOutputDto,
    cashFlow: CashFlowReportOutputDto = emptyCashFlow,
    forecast: SpendingForecastDto = EMPTY_FORECAST,
    uncategorised: UncategorisedReportDto = EMPTY_UNCATEGORISED,
    extra: {
      netWorth?: NetWorthReportDto;
      accounts?: AccountOutputDto[];
      recurring?: RecurringReportDto;
    } = {},
  ): Promise<{ dashboard: DashboardComponent; root: HTMLElement }> {
    const fixture = TestBed.createComponent(DashboardComponent);
    TestBed.tick();
    // The year report would say August cost far more in total; the hint must not use it.
    http.expectOne('/api/Reports/monthly-categorized-graph').flush({
      categories: categoryRefs('Dining'),
      averageMonthlyTotal: 2000,
      monthlyData: [{ month: 'Aug 2026', total: 2000, categoryValues: { Dining: 2000 } }],
    });
    http.expectOne('/api/Reports/current-month-categorized-graph').flush(month);
    http.expectOne('/api/Reports/cash-flow').flush(cashFlow);
    http.expectOne('/api/Budget/Filter').flush(emptyPage);
    http.expectOne('/api/Transaction/Filter').flush(emptyPage);
    http.expectOne('/api/Reports/forecast').flush(forecast);
    http.expectOne('/api/Reports/uncategorised').flush(uncategorised);
    http.expectOne('/api/Reports/net-worth').flush(extra.netWorth ?? EMPTY_NET_WORTH);
    http.expectOne('/api/Accounts').flush(extra.accounts ?? []);
    http.expectOne('/api/Reports/recurring').flush(extra.recurring ?? EMPTY_RECURRING);
    await fixture.whenStable();
    return { dashboard: fixture.componentInstance, root: fixture.nativeElement as HTMLElement };
  }

  it('compares this month so far with last month up to the same day', async () => {
    const { dashboard } = await load(currentMonth(300, 250));

    expect(dashboard.spentHint()).toEqual({ text: '20% more than Aug 1–5', tone: 'bad', up: true });
  });

  it('puts this month against a usual one, the average of the finished months', async () => {
    const { dashboard } = await load(currentMonth(300, 250));

    // September 5th: a usual $2,000 month has cost 5/30 of it, $333.33, by now.
    expect(dashboard.usualHint()).toEqual({
      text: '$33.33 under a usual month by now',
      tone: 'good',
      up: false,
    });
  });

  it('shows no comparison without last month’s figure', async () => {
    expect((await load(currentMonth(300))).dashboard.spentHint()).toBeNull();
  });

  it('shows income, spending and what was left over per month with their averages', async () => {
    const { root } = await load(currentMonth(300), {
      months: [
        { month: 'Aug 2026', income: 5000, spending: 3200, net: 1800, savingsChange: 0 },
        { month: 'Sep 2026', income: 2500, spending: 300, net: 2200, savingsChange: 0 },
      ],
      averageMonthlyIncome: 5000,
      averageMonthlySpending: 3200,
      averageMonthlyNet: 1800,
      averageMonthlySavingsChange: 0,
      averagedMonths: 1,
      averagesIncludeCurrentMonth: false,
    });
    const card = root.querySelector('app-cash-flow')!;

    expect(card.querySelector('canvas')).not.toBeNull();
    const figures = Array.from(card.querySelectorAll('dl > div')).map((e) =>
      e.textContent!.replace(/\s+/g, ' ').trim(),
    );
    // No savings account changed: there is no savings figure to show.
    expect(figures).toEqual(['Income $5,000.00', 'Spending $3,200.00', 'Left over $1,800.00']);
    expect(card.textContent).toContain('Averages per month · Over 1 finished month');
    expect(card.textContent).not.toContain('Savings change');
  });

  it('adds how the savings accounts changed when one did, and marks a negative average', async () => {
    const { root } = await load(currentMonth(300), {
      months: [{ month: 'Sep 2026', income: 1000, spending: 1500, net: -500, savingsChange: -200 }],
      averageMonthlyIncome: 1000,
      averageMonthlySpending: 1500,
      averageMonthlyNet: -500,
      averageMonthlySavingsChange: -200,
      averagedMonths: 1,
      averagesIncludeCurrentMonth: true,
    });
    const card = root.querySelector('app-cash-flow')!;

    const figures = Array.from(card.querySelectorAll('dl > div')).map((e) =>
      e.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(figures).toEqual([
      'Income $1,000.00',
      'Spending $1,500.00',
      'Left over -$500.00',
      'Savings change -$200.00',
    ]);
    expect(card.querySelectorAll('dd.text-danger').length).toBe(2);
    expect(card.textContent).toContain('Averages per month · This month so far');
    expect(card.textContent).toContain('Savings change is what went into your savings accounts');
  });

  it('has every figure of the chart in a table too, and back', async () => {
    const { root } = await load(currentMonth(300), {
      months: [
        { month: 'Aug 2026', income: 5000, spending: 3200, net: 1800, savingsChange: 0 },
        { month: 'Sep 2026', income: 1000, spending: 1500, net: -500, savingsChange: 0 },
      ],
      averageMonthlyIncome: 5000,
      averageMonthlySpending: 3200,
      averageMonthlyNet: 1800,
      averageMonthlySavingsChange: 0,
      averagedMonths: 1,
      averagesIncludeCurrentMonth: false,
    });
    const card = root.querySelector('app-cash-flow')!;
    const show = (label: string) =>
      Array.from(card.querySelectorAll<HTMLButtonElement>('[aria-label="Show as"] button'))
        .find((button) => button.textContent!.trim() === label)!
        .click();

    show('Table');
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();

    expect(card.querySelector('canvas')).toBeNull();
    const rows = Array.from(card.querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('th, td')).map((cell) => cell.textContent!.trim()),
    );
    expect(rows).toEqual([
      ['Aug 2026', '$5,000.00', '$3,200.00', '$1,800.00'],
      ['Sep 2026', '$1,000.00', '$1,500.00', '-$500.00'],
    ]);
    expect(card.querySelector('td.text-danger')!.textContent).toContain('-$500.00');

    show('Chart');
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    expect(card.querySelector('canvas')).not.toBeNull();
  });

  it('keeps the page working when a report fails, saying so where it would be', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    TestBed.tick();
    http
      .expectOne('/api/Reports/monthly-categorized-graph')
      .flush(null, { status: 500, statusText: 'Error' });
    http.expectOne('/api/Reports/current-month-categorized-graph').flush(currentMonth(300));
    http.expectOne('/api/Reports/cash-flow').flush(emptyCashFlow);
    http.expectOne('/api/Budget/Filter').flush(null, { status: 500, statusText: 'Error' });
    http.expectOne('/api/Transaction/Filter').flush(emptyPage);
    http.expectOne('/api/Reports/forecast').flush(null, { status: 500, statusText: 'Error' });
    // Unknown, the nudge to sort what is in Other just doesn't show.
    http.expectOne('/api/Reports/uncategorised').flush(null, { status: 500, statusText: 'Error' });
    http.expectOne('/api/Reports/net-worth').flush(null, { status: 500, statusText: 'Error' });
    http.expectOne('/api/Accounts').flush(null, { status: 500, statusText: 'Error' });
    http.expectOne('/api/Reports/recurring').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    // innerText: the tile's label, value and hint are separate blocks.
    const tiles = Array.from(root.querySelectorAll<HTMLElement>('app-stat-card')).map((tile) =>
      tile.innerText.replace(/\s+/g, ' ').trim(),
    );
    expect(tiles).toEqual([
      expect.stringContaining('Spent this month $300.00'),
      expect.stringContaining('Left over this month — No income or spending yet'),
      expect.stringContaining('Net worth — Could not load this'),
      expect.stringContaining('Budgets — Could not load this'),
    ]);
    expect(root.textContent).toContain('Could not load monthly spending.');
    expect(root.textContent).toContain('Could not load budgets.');
    expect(root.textContent).toContain('Could not work out the forecast.');
    expect(root.querySelector('.attention')).toBeNull();
  });

  it('says when nothing is recorded this year', async () => {
    const { root } = await load(currentMonth(300));

    expect(root.querySelector('app-cash-flow')).toBeNull();
    expect(root.textContent).toContain('Nothing recorded this year yet.');
  });

  it('says where the month is heading: spent, still due and the usual day-to-day', async () => {
    const { root } = await load(currentMonth(55), emptyCashFlow, TEST_FORECAST);

    // innerText: the figures are separate blocks.
    const card = root
      .querySelector<HTMLElement>('app-month-forecast')!
      .innerText.replace(/\s+/g, ' ');
    expect(card).toContain('$1,215.00 by the end of the month');
    expect(card).toContain('8% less than usual ($1,321.67, the average of the last 3 months)');
    expect(card).toContain('Recurring still due $1,000.00');
    expect(card).toContain('Day-to-day, 16 days at $10.00 $160.00');
    expect(card).toContain('LANDLORD · Oct 20 $1,000.00');
    expect(card).toContain('Food $460.00 of $400.00 (115%)');
  });

  it('points to the rules when transactions are left in Other', async () => {
    const { root } = await load(
      currentMonth(55),
      emptyCashFlow,
      EMPTY_FORECAST,
      TEST_UNCATEGORISED,
    );

    const attention = root.querySelector('.attention')!;
    expect(attention.textContent!.replace(/\s+/g, ' ')).toContain(
      '4 transactions are in Other because no rule names their merchants',
    );
    expect(attention.querySelector('a')!.getAttribute('href')).toBe('/rules#unsorted');
  });

  it('says nothing about Other when every transaction is sorted', async () => {
    const { root } = await load(currentMonth(55));

    expect(root.querySelector('.attention')).toBeNull();
  });

  it('doesn’t warn about what is left over before any income this month', async () => {
    const { root } = await load(currentMonth(300), {
      ...emptyCashFlow,
      months: [{ month: 'Sep 2026', income: 0, spending: 300, net: -300, savingsChange: 0 }],
    });

    const tile = root.querySelectorAll<HTMLElement>('app-stat-card')[1];
    expect(tile.innerText.replace(/\s+/g, ' ').trim()).toBe(
      'Left over this month -$300.00 No income yet this month',
    );
    expect(tile.querySelector('.text-danger')).toBeNull();
  });

  it('shows what was left over this month, and net worth with its change since last month', async () => {
    const { root } = await load(
      currentMonth(300),
      {
        ...emptyCashFlow,
        months: [{ month: 'Sep 2026', income: 4000, spending: 2600, net: 1400, savingsChange: 0 }],
      },
      EMPTY_FORECAST,
      EMPTY_UNCATEGORISED,
      { netWorth: TEST_NET_WORTH },
    );

    const tiles = Array.from(root.querySelectorAll<HTMLElement>('app-stat-card')).map((tile) =>
      tile.innerText.replace(/\s+/g, ' ').trim(),
    );
    expect(tiles[1]).toBe('Left over this month $1,400.00 Income less spending so far');
    expect(tiles[2]).toContain('Net worth $15,000.00 +$500.00 since last month');
    expect(root.querySelector('a.stat-link')!.getAttribute('href')).toBe('/net-worth');
  });

  it('lists what needs attention: budgets over, statements not imported, price changes', async () => {
    const { root } = await load(
      currentMonth(300),
      emptyCashFlow,
      EMPTY_FORECAST,
      EMPTY_UNCATEGORISED,
      {
        accounts: [
          {
            id: 'a1',
            name: 'Wealthsimple TFSA',
            type: AccountType.Investment,
            format: StatementFormat.Wealthsimple,
            transactionCount: 3,
            lastTransactionDate: '2026-06-16T00:00:00Z',
            balance: { id: 'b1', date: '2026-06-30T00:00:00Z', amount: 4380.73 },
          },
          {
            id: 'a2',
            name: 'Chequing',
            type: AccountType.Chequing,
            format: StatementFormat.Cibc,
            transactionCount: 40,
            lastTransactionDate: '2026-09-02T00:00:00Z',
          },
        ],
        recurring: {
          monthlyTotal: 20,
          yearlyTotal: 240,
          payments: [
            {
              ...TEST_RECURRING_PAYMENT,
              name: 'NETFLIX',
              priceChange: { from: 16.49, to: 18.99, since: '2026-08-20' },
            },
          ],
        },
      },
    );

    const items = Array.from(root.querySelectorAll<HTMLElement>('.attention li')).map((li) =>
      li.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(items).toEqual([
      "Wealthsimple TFSA: statements reach Jun 30, 2026. Import last month's",
      'NETFLIX went up from $16.49 to $18.99',
    ]);
  });

  it('lists investments with their balance and this year’s room', async () => {
    const { root } = await load(
      currentMonth(300),
      emptyCashFlow,
      EMPTY_FORECAST,
      EMPTY_UNCATEGORISED,
      {
        accounts: [
          {
            id: 'a1',
            name: 'Wealthsimple TFSA',
            type: AccountType.Investment,
            format: StatementFormat.Wealthsimple,
            transactionCount: 3,
            plan: RegisteredPlan.Tfsa,
            contributionRoom: 7000,
            contributionRoomYear: 2026,
            depositedThisYear: 5300,
            roomLeft: 1700,
            balance: { id: 'b1', date: '2026-08-31T00:00:00Z', amount: 4380.73 },
          },
        ],
      },
    );

    const card = root.querySelector<HTMLElement>('.investment')!.innerText.replace(/\s+/g, ' ');
    expect(card).toContain('Wealthsimple TFSA TFSA $4,380.73');
    expect(card).toContain(
      'Balance on Aug 31, 2026 · $5,300.00 in this year · $1,700.00 room left',
    );
  });

  it('switches the category card between this month and a usual one', async () => {
    const { dashboard, root } = await load(currentMonth(300));
    expect(root.querySelector('app-category-breakdown')).not.toBeNull();

    dashboard.categoryView.set('usual');
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();

    expect(root.querySelector('app-category-breakdown')).toBeNull();
    expect(root.querySelector('app-category-averages')).not.toBeNull();
  });
});
