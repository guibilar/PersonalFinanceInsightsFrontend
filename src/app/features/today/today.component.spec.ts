import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TodayComponent } from './today.component';
import { categoryRefs } from '../../testing/test-categories';

describe('TodayComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TodayComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
  });

  it('shows the four finance tiles first, then a placeholder card per module to come', async () => {
    const fixture = TestBed.createComponent(TodayComponent);
    TestBed.tick();
    const http = TestBed.inject(HttpTestingController);
    const report = {
      categories: categoryRefs('Dining'),
      averageMonthlyTotal: 0,
      monthlyData: [],
    };
    http.expectOne('/api/Reports/monthly-categorized-graph').flush(report);
    http.expectOne('/api/Reports/current-month-categorized-graph').flush(report);
    http.expectOne('/api/Reports/cash-flow').flush({
      months: [],
      averageMonthlyIncome: 0,
      averageMonthlySpending: 0,
      averageMonthlyNet: 0,
      averageMonthlySavingsChange: 0,
      averagedMonths: 0,
      averagesIncludeCurrentMonth: false,
    });
    http.expectOne('/api/Reports/net-worth').flush({
      assets: 0,
      liabilities: 0,
      netWorth: 1500,
      accounts: [],
      months: [],
    });
    http.expectOne('/api/Budget/Filter').flush({
      items: [],
      page: 1,
      pageSize: 1000,
      totalCount: 0,
      totalPages: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    });
    http.verify();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const tiles = Array.from(root.querySelectorAll('app-stat-card')).map((tile) =>
      tile.querySelector('p')!.textContent!.trim(),
    );
    expect(tiles).toEqual(['Spent this month', 'Left over this month', 'Net worth', 'Budgets']);
    expect(root.querySelector('a[href="/money/net-worth"]')).not.toBeNull();
    expect(root.querySelector('a[href="/money"]')!.textContent).toContain('Open Money');

    expect(
      Array.from(root.querySelectorAll('.placeholder-card')).map((card) =>
        card.getAttribute('data-module'),
      ),
    ).toEqual(['documents', 'home', 'people', 'journal', 'tasks']);
  });

  it('keeps the other tiles when one report fails', async () => {
    const fixture = TestBed.createComponent(TodayComponent);
    TestBed.tick();
    const http = TestBed.inject(HttpTestingController);
    for (const url of [
      '/api/Reports/monthly-categorized-graph',
      '/api/Reports/current-month-categorized-graph',
      '/api/Reports/cash-flow',
      '/api/Budget/Filter',
    ]) {
      http.expectOne(url).flush(null, { status: 500, statusText: 'Error' });
    }
    http.expectOne('/api/Reports/net-worth').flush({
      assets: 0,
      liabilities: 0,
      netWorth: 1500,
      accounts: [],
      months: [],
    });
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('app-stat-card').length).toBe(4);
    expect(root.textContent).toContain('Could not load this');
    expect(root.querySelector('a[href="/money/net-worth"]')!.textContent).toContain('$1,500.00');
  });
});
