import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { CategorizedReportOutputDto } from '../../core/models/outputs/categorized-report-output-dto';
import { CashFlowReportOutputDto } from '../../core/models/outputs/cash-flow-report-output-dto';
import { categoryRefs } from '../../testing/test-categories';

const emptyPage = {
  items: [],
  page: 1,
  pageSize: 6,
  totalCount: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

const emptyCashFlow: CashFlowReportOutputDto = {
  months: [],
  averageMonthlyIncome: 0,
  averageMonthlySpending: 0,
  averageMonthlySaved: 0,
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
    http.verify();
    vi.useRealTimers();
  });

  async function load(
    month: CategorizedReportOutputDto,
    cashFlow: CashFlowReportOutputDto = emptyCashFlow,
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
    await fixture.whenStable();
    return { dashboard: fixture.componentInstance, root: fixture.nativeElement as HTMLElement };
  }

  it('compares this month so far with last month up to the same day', async () => {
    const { dashboard } = await load(currentMonth(300, 250));

    expect(dashboard.spentHint()).toEqual({ text: '20% more than Aug 1–5', tone: 'bad', up: true });
  });

  it('says the average covers finished months only', async () => {
    const { dashboard } = await load(currentMonth(300, 250));

    expect(dashboard.averageHint()).toBe('Over 1 finished month');
  });

  it('shows no comparison without last month’s figure', async () => {
    expect((await load(currentMonth(300))).dashboard.spentHint()).toBeNull();
  });

  it('shows income, spending and saved per month with their averages', async () => {
    const { root } = await load(currentMonth(300), {
      months: [
        { month: 'Aug 2026', income: 5000, spending: 3200, net: 1800, saved: 1000 },
        { month: 'Sep 2026', income: 2500, spending: 300, net: 2200, saved: 0 },
      ],
      averageMonthlyIncome: 5000,
      averageMonthlySpending: 3200,
      averageMonthlySaved: 1000,
    });
    const card = root.querySelector('app-cash-flow')!;

    expect(card.querySelector('canvas')).not.toBeNull();
    const figures = Array.from(card.querySelectorAll('dl > div')).map((e) =>
      e.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(figures).toEqual(['Income $5,000.00', 'Spending $3,200.00', 'Saved $1,000.00']);
    expect(card.textContent).toContain('Averages per month · Over 1 finished month');
  });

  it('says when nothing is recorded this year', async () => {
    const { root } = await load(currentMonth(300));

    expect(root.querySelector('app-cash-flow')).toBeNull();
    expect(root.textContent).toContain('Nothing recorded this year yet.');
  });
});
