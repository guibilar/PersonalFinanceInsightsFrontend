import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { CategorizedReportOutputDto } from '../../core/models/outputs/categorized-report-output-dto';

const emptyPage = {
  items: [],
  page: 1,
  pageSize: 6,
  totalCount: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

function currentMonth(
  spent: number,
  previousMonthToDateTotal?: number,
): CategorizedReportOutputDto {
  return {
    categories: ['Dining'],
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

  async function load(month: CategorizedReportOutputDto): Promise<DashboardComponent> {
    const fixture = TestBed.createComponent(DashboardComponent);
    TestBed.tick();
    // The year report would say August cost far more in total; the hint must not use it.
    http.expectOne('/api/Reports/monthly-categorized-graph').flush({
      categories: ['Dining'],
      averageMonthlyTotal: 2000,
      monthlyData: [{ month: 'Aug 2026', total: 2000, categoryValues: { Dining: 2000 } }],
    });
    http.expectOne('/api/Reports/current-month-categorized-graph').flush(month);
    http.expectOne('/api/Budget/Filter').flush(emptyPage);
    http.expectOne('/api/Transaction/Filter').flush(emptyPage);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('compares this month so far with last month up to the same day', async () => {
    const dashboard = await load(currentMonth(300, 250));

    expect(dashboard.spentHint()).toEqual({ text: '20% more than Aug 1–5', tone: 'bad', up: true });
  });

  it('says the average covers finished months only', async () => {
    const dashboard = await load(currentMonth(300, 250));

    expect(dashboard.averageHint()).toBe('Over 1 finished month');
  });

  it('shows no comparison without last month’s figure', async () => {
    expect((await load(currentMonth(300))).spentHint()).toBeNull();
  });
});
