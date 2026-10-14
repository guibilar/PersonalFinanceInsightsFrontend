import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { DashboardComponent } from './dashboard.component';
import { FinanceTilesComponent } from './finance-tiles/finance-tiles.component';
import { CategorizedReportOutputDto } from '../../core/models/outputs/categorized-report-output-dto';
import { CashFlowReportOutputDto } from '../../core/models/outputs/cash-flow-report-output-dto';
import { categoryRefs } from '../../testing/test-categories';
import { SpendingForecastDto } from '../../core/models/outputs/insights-output-dto';
import { NetWorthReportDto } from '../../core/models/outputs/net-worth-output-dto';
import { AccountOutputDto } from '../../core/models/outputs/account-output-dto';
import { AlertDto, AlertListDto } from '../../core/models/outputs/alert-output-dto';
import { DataChangesService } from '../../core/data/data-changes.service';
import { AccountType } from '../../core/models/enums/account-type';
import { StatementFormat } from '../../core/models/enums/statement-format';
import { RegisteredPlan } from '../../core/models/enums/registered-plan';
import { EMPTY_FORECAST, TEST_FORECAST } from '../../testing/test-insights';

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

const NO_ALERTS: AlertListDto = {
  checkedAt: '2026-09-05T11:00:00Z',
  modules: [
    { module: 'Money', order: 0, status: 'Complete' },
    { module: 'Documents', order: 10, status: 'Complete' },
  ],
  alerts: [],
};

/** An open alert, as `GET /api/alerts` sends it. */
function alert(fields: Partial<AlertDto> & Pick<AlertDto, 'id' | 'kind' | 'text'>): AlertDto {
  return {
    alertId: `alert-${fields.id}`,
    module: 'Money',
    type: 'Attention',
    title: fields.kind,
    values: {},
    severity: 'Warning',
    link: null,
    raisedAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    ...fields,
  };
}

function alerts(
  items: AlertDto[],
  moneyStatus: AlertListDto['modules'][number]['status'] = 'Complete',
): AlertListDto {
  return {
    ...NO_ALERTS,
    modules: [
      { module: 'Money', order: 0, status: moneyStatus },
      { module: 'Documents', order: 10, status: 'Complete' },
    ],
    alerts: items,
  };
}

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
    http.match((r) => r.url === '/api/alerts').forEach((r) => r.flush(NO_ALERTS));
    http.match('/api/Reports/net-worth').forEach((r) => r.flush(EMPTY_NET_WORTH));
    http.match('/api/Accounts').forEach((r) => r.flush([]));
    http.verify();
    vi.useRealTimers();
  });

  async function load(
    month: CategorizedReportOutputDto,
    cashFlow: CashFlowReportOutputDto = emptyCashFlow,
    forecast: SpendingForecastDto = EMPTY_FORECAST,
    alertList: AlertListDto = NO_ALERTS,
    extra: {
      netWorth?: NetWorthReportDto;
      accounts?: AccountOutputDto[];
      year?: CategorizedReportOutputDto;
    } = {},
  ): Promise<{
    dashboard: DashboardComponent;
    tiles: FinanceTilesComponent;
    root: HTMLElement;
    fixture: ReturnType<typeof TestBed.createComponent<DashboardComponent>>;
  }> {
    const fixture = TestBed.createComponent(DashboardComponent);
    TestBed.tick();
    // The year report would say August cost far more in total; the hint must not use it.
    http.expectOne('/api/Reports/monthly-categorized-graph').flush(
      extra.year ?? {
        categories: categoryRefs('Dining'),
        averageMonthlyTotal: 2000,
        monthlyData: [{ month: 'Aug 2026', total: 2000, categoryValues: { Dining: 2000 } }],
      },
    );
    http.expectOne('/api/Reports/current-month-categorized-graph').flush(month);
    http.expectOne('/api/Reports/cash-flow').flush(cashFlow);
    http.expectOne('/api/Budget/Filter').flush(emptyPage);
    http.expectOne('/api/Transaction/Filter').flush(emptyPage);
    http.expectOne('/api/Reports/forecast').flush(forecast);
    http.expectOne('/api/Reports/net-worth').flush(extra.netWorth ?? EMPTY_NET_WORTH);
    http.expectOne('/api/Accounts').flush(extra.accounts ?? []);
    // The first load uses the alerts that the server keeps.
    http.expectOne('/api/alerts').flush(alertList);
    await fixture.whenStable();
    return {
      dashboard: fixture.componentInstance,
      // The headline tiles, shared with Today.
      tiles: fixture.debugElement.query(By.directive(FinanceTilesComponent))
        .componentInstance as FinanceTilesComponent,
      root: fixture.nativeElement as HTMLElement,
      fixture,
    };
  }

  it('compares this month so far with last month up to the same day', async () => {
    const { tiles } = await load(currentMonth(300, 250));

    expect(tiles.spentHint()).toEqual({ text: '20% more than Aug 1–5', tone: 'bad', up: true });
  });

  it('puts this month against a usual one, the average of the finished months', async () => {
    const { tiles } = await load(currentMonth(300, 250));

    // September 5th: a usual $2,000 month has cost 5/30 of it, $333.33, by now.
    expect(tiles.usualHint()).toEqual({
      text: '$33.33 under a usual month by now',
      tone: 'good',
      up: false,
    });
  });

  it('puts this month against no usual one while it is the only one of the year', async () => {
    // The API averages the running month itself then: this month against itself.
    const { tiles } = await load(currentMonth(300, 250), undefined, undefined, undefined, {
      year: {
        categories: categoryRefs('Dining'),
        averageMonthlyTotal: 300,
        monthlyData: [{ month: 'Sep 2026', total: 300, categoryValues: { Dining: 300 } }],
      },
    });

    expect(tiles.usualHint()).toBeNull();
  });

  it('trusts the API on whether its average is of the running month', async () => {
    const { tiles } = await load(currentMonth(300, 250), undefined, undefined, undefined, {
      year: {
        categories: categoryRefs('Dining'),
        averageMonthlyTotal: 2000,
        averageIncludesCurrentMonth: true,
        monthlyData: [{ month: 'Aug 2026', total: 2000, categoryValues: { Dining: 2000 } }],
      },
    });

    expect(tiles.usualHint()).toBeNull();
  });

  it('shows no comparison without last month’s figure', async () => {
    expect((await load(currentMonth(300))).tiles.spentHint()).toBeNull();
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
    http.expectOne('/api/Reports/net-worth').flush(null, { status: 500, statusText: 'Error' });
    http.expectOne('/api/Accounts').flush(null, { status: 500, statusText: 'Error' });
    http.expectOne('/api/alerts').flush(null, { status: 500, statusText: 'Error' });
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
    expect(root.textContent).toContain('Could not check what needs attention.');
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
    expect(card).toContain('Day-to-day, 16 days at $10.00 a day: $160.00');
    expect(card).toContain('LANDLORD · Oct 20 $1,000.00');
    expect(card).toContain('Food $460.00 of $400.00 (115%)');
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
      NO_ALERTS,
      { netWorth: TEST_NET_WORTH },
    );

    const tiles = Array.from(root.querySelectorAll<HTMLElement>('app-stat-card')).map((tile) =>
      tile.innerText.replace(/\s+/g, ' ').trim(),
    );
    expect(tiles[1]).toBe('Left over this month $1,400.00 Income less spending so far');
    expect(tiles[2]).toContain('Net worth $15,000.00 +$500.00 since last month');
    expect(root.querySelector('a.stat-link')!.getAttribute('href')).toBe('/money/net-worth');
  });

  it('lists investments with their balance and this year’s room', async () => {
    const { root } = await load(currentMonth(300), emptyCashFlow, EMPTY_FORECAST, NO_ALERTS, {
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
    });

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

  /** After a data change: answers the reports that load again, with no data. The alerts stay open. */
  function flushReportsAgain(): void {
    const empty: Record<string, object> = {
      '/api/Reports/monthly-categorized-graph': currentMonth(0),
      '/api/Reports/current-month-categorized-graph': currentMonth(0),
      '/api/Reports/cash-flow': emptyCashFlow,
      '/api/Budget/Filter': emptyPage,
      '/api/Transaction/Filter': emptyPage,
      '/api/Reports/forecast': EMPTY_FORECAST,
      '/api/Reports/net-worth': EMPTY_NET_WORTH,
      '/api/Accounts': [],
    };
    for (const [url, body] of Object.entries(empty)) http.expectOne(url).flush(body);
  }

  /** The "Needs attention" items, as text. */
  function attentionTexts(root: HTMLElement): string[] {
    return Array.from(root.querySelectorAll<HTMLElement>('.attention li')).map((li) =>
      li.textContent!.replace(/\s+/g, ' ').trim(),
    );
  }

  it('lists the Money alerts of the server, in its order, with their values and links', async () => {
    const { root } = await load(
      currentMonth(300),
      emptyCashFlow,
      EMPTY_FORECAST,
      alerts([
        alert({
          id: 'money.budget-over.b1',
          kind: 'budget-over',
          text: '{budget} is over its limit ({used} used)',
          values: {
            budget: { type: 'Text', text: 'Groceries' },
            used: { type: 'Percent', number: 120 },
          },
          severity: 'Bad',
          link: '/money/budgets',
        }),
        alert({
          id: 'documents.expires-soon.d1',
          module: 'Documents',
          kind: 'expires-soon',
          text: 'Lease expires soon',
          link: '/documents/d1',
        }),
        alert({
          id: 'money.statements-behind.a1',
          kind: 'statements-behind',
          text: "{account}: statements reach {reach}. Import last month's",
          values: {
            account: { type: 'Text', text: 'Wealthsimple TFSA' },
            reach: { type: 'Date', date: '2026-06-30' },
          },
          link: '/money/transactions#import',
        }),
        alert({
          id: 'money.price-changed.NETFLIX',
          kind: 'price-changed',
          text: '{payment} went up from {from} to {to}',
          values: {
            payment: { type: 'Text', text: 'NETFLIX' },
            from: { type: 'Money', number: 16.49 },
            to: { type: 'Money', number: 18.99 },
          },
          link: '/money/subscriptions',
        }),
        alert({
          id: 'money.unsorted',
          kind: 'unsorted',
          text: '{count} transactions are in Other because no rule names their merchants',
          values: { count: { type: 'Count', number: 4 } },
          link: '/money/rules#unsorted',
        }),
      ]),
    );

    // Only Money: the other modules' alerts are for Today and the bell.
    expect(attentionTexts(root)).toEqual([
      'Groceries is over its limit (120% used)',
      "Wealthsimple TFSA: statements reach Jun 30, 2026. Import last month's",
      'NETFLIX went up from $16.49 to $18.99',
      '4 transactions are in Other because no rule names their merchants',
    ]);
    const links = Array.from(root.querySelectorAll('.attention a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(links).toEqual([
      '/money/budgets',
      '/money/transactions#import',
      '/money/subscriptions',
      '/money/rules#unsorted',
    ]);
    expect(
      root
        .querySelector('[data-card="money.budget-over.b1"] .attention-icon')!
        .getAttribute('data-severity'),
    ).toBe('Bad');
    expect(root.querySelector('[data-attention-status]')).toBeNull();
  });

  it('shows no "Needs attention" list when no Money alert is open', async () => {
    const { root } = await load(
      currentMonth(300),
      emptyCashFlow,
      EMPTY_FORECAST,
      alerts([
        alert({
          id: 'documents.expires-soon.d1',
          module: 'Documents',
          kind: 'expires-soon',
          text: 'Lease',
        }),
      ]),
    );

    expect(root.querySelector('.attention')).toBeNull();
    expect(root.textContent).not.toContain('Could not check what needs attention.');
  });

  it('says when the last check of the Money rules was partial, and keeps the stored alerts', async () => {
    const { root } = await load(
      currentMonth(300),
      emptyCashFlow,
      EMPTY_FORECAST,
      alerts(
        [
          alert({
            id: 'money.unsorted',
            kind: 'unsorted',
            text: '{count} transaction is in Other because no rule names its merchant',
            values: { count: { type: 'Count', number: 1 } },
            link: '/money/rules#unsorted',
          }),
        ],
        'Partial',
      ),
    );

    expect(root.querySelector('[data-attention-status="partial"]')!.textContent).toContain(
      'Some checks could not run',
    );
    expect(attentionTexts(root)).toEqual([
      '1 transaction is in Other because no rule names its merchant',
    ]);
  });

  it('says that a partial check found nothing it could show', async () => {
    const { root } = await load(
      currentMonth(300),
      emptyCashFlow,
      EMPTY_FORECAST,
      alerts([], 'Partial'),
    );

    expect(root.querySelector('.attention [data-attention-status="partial"]')).not.toBeNull();
    expect(root.querySelectorAll('.attention li').length).toBe(0);
  });

  it('shows a retry when the Money rules could not be checked, and the rest of the page still shows', async () => {
    const { root, fixture } = await load(
      currentMonth(300),
      emptyCashFlow,
      EMPTY_FORECAST,
      alerts([], 'Failed'),
    );

    const error = root.querySelector('[data-attention-status="failed"]')!;
    expect(error.textContent).toContain('Could not check what needs attention.');
    expect(root.querySelector('app-category-breakdown')).not.toBeNull();

    error.querySelector('button')!.click();
    TestBed.tick();
    // A retry asks the server for a new check; the reports do not load again.
    http.expectOne('/api/alerts?refresh=true').flush(
      alerts([
        alert({
          id: 'money.unsorted',
          kind: 'unsorted',
          text: 'Sorted out',
          link: '/money/rules#unsorted',
        }),
      ]),
    );
    await fixture.whenStable();

    expect(root.querySelector('[data-attention-status]')).toBeNull();
    expect(attentionTexts(root)).toEqual(['Sorted out']);
  });

  it('asks for a new check after a data change from this app', async () => {
    const { root, fixture } = await load(currentMonth(300));

    TestBed.inject(DataChangesService).changed();
    TestBed.tick();
    flushReportsAgain();
    http.expectOne('/api/alerts?refresh=true').flush(
      alerts([
        alert({
          id: 'money.statements-not-imported',
          kind: 'statements-not-imported',
          text: 'No statements imported in {days} days',
          values: { days: { type: 'Count', number: 9 } },
          link: '/money/transactions#import',
        }),
      ]),
    );
    await fixture.whenStable();

    expect(attentionTexts(root)).toEqual(['No statements imported in 9 days']);
  });

  it('shows no list and no error when the API has no alerts (the finance backend alone)', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    TestBed.tick();
    flushReportsAgain();
    http.expectOne('/api/alerts').flush(null, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.attention')).toBeNull();
    expect(root.textContent).not.toContain('Could not check what needs attention.');
  });
});
