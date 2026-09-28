import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReportsRepository } from './reports-repository';

describe('ReportsRepository', () => {
  let repository: ReportsRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    repository = TestBed.inject(ReportsRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets the cash-flow report', () => {
    let months: number | undefined;
    repository.getCashFlow().subscribe((report) => (months = report.months.length));

    http.expectOne({ method: 'GET', url: '/api/Reports/cash-flow' }).flush({
      months: [{ month: 'Jan 2026', income: 5000, spending: 3000, net: 2000, saved: 500 }],
      averageMonthlyIncome: 5000,
      averageMonthlySpending: 3000,
      averageMonthlySaved: 500,
    });

    expect(months).toBe(1);
  });
});
