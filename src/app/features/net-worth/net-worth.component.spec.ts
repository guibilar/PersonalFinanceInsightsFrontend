import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NetWorthComponent, netWorthChart } from './net-worth.component';
import { AccountType } from '../../core/models/enums/account-type';
import { RegisteredPlan } from '../../core/models/enums/registered-plan';
import { NetWorthReportDto } from '../../core/models/outputs/net-worth-output-dto';
import { CHART_THEMES } from '../../shared/charts/chart-theme';

const report: NetWorthReportDto = {
  assets: 8000,
  liabilities: 250,
  netWorth: 7750,
  accounts: [
    {
      id: 'a1',
      name: 'Chequing',
      type: AccountType.Chequing,
      plan: RegisteredPlan.None,
      balance: 2500,
      balanceDate: '2026-09-30T00:00:00Z',
      movedSince: true,
      isLiability: false,
    },
    {
      id: 'a2',
      name: 'Savings',
      type: AccountType.Savings,
      plan: RegisteredPlan.None,
      balance: null,
      balanceDate: null,
      movedSince: false,
      isLiability: false,
    },
    {
      id: 'a3',
      name: 'Visa',
      type: AccountType.CreditCard,
      plan: RegisteredPlan.None,
      balance: 250,
      balanceDate: '2026-09-30T00:00:00Z',
      movedSince: true,
      isLiability: true,
    },
    {
      id: 'a4',
      name: 'Wealthsimple',
      type: AccountType.Investment,
      plan: RegisteredPlan.Tfsa,
      balance: 5500,
      balanceDate: '2026-09-30T00:00:00Z',
      movedSince: false,
      isLiability: false,
    },
  ],
  months: [
    {
      month: 'Aug 2026',
      date: '2026-08-31T00:00:00Z',
      assets: 1000,
      liabilities: 0,
      netWorth: 1000,
      accountsCounted: 1,
    },
    {
      month: 'Sep 2026',
      date: '2026-09-30T00:00:00Z',
      assets: 6000,
      liabilities: 200,
      netWorth: 5800,
      accountsCounted: 3,
    },
    {
      month: 'Oct 2026',
      date: '2026-10-15T00:00:00Z',
      assets: 8000,
      liabilities: 250,
      netWorth: 7750,
      accountsCounted: 3,
    },
  ],
};

describe('NetWorthComponent', () => {
  let fixture: ComponentFixture<NetWorthComponent>;
  let http: HttpTestingController;

  const root = () => fixture.nativeElement as HTMLElement;

  async function load(value: NetWorthReportDto): Promise<void> {
    TestBed.configureTestingModule({
      imports: [NetWorthComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(NetWorthComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    TestBed.tick();
    http.expectOne('/api/Reports/net-worth').flush(value);
    await fixture.whenStable();
  }

  afterEach(() => http.verify());

  it('shows the net worth, its change since last month, and each account', async () => {
    await load(report);

    const cards = Array.from(root().querySelectorAll('app-stat-card')).map((c) =>
      (c as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
    );
    expect(cards).toEqual([
      'Net worth $7,750.00 +$1,950.00 since last month',
      'Assets $8,000.00',
      'Owed on cards $250.00',
    ]);
    const rows = Array.from(root().querySelectorAll('[aria-label="Accounts"] li')).map((li) =>
      (li as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
    );
    expect(rows).toEqual([
      'Chequing Chequing $2,500.00 Entered Sep 30, 2026, moved since',
      'Savings Savings Add its balance',
      'Visa Credit card −$250.00 Entered Sep 30, 2026, moved since',
      'Wealthsimple Investment · TFSA $5,500.00 As of Sep 30, 2026',
    ]);
    expect(root().textContent).toContain(
      'Earlier months leave out accounts whose history starts later.',
    );
  });

  it('charts a bar per month, with assets and card debt in the tooltip', () => {
    const chart = netWorthChart(report, CHART_THEMES.light);
    const footer = chart.options!.plugins!.tooltip!.callbacks!.footer as unknown as (
      items: { dataIndex: number }[],
    ) => string[];

    expect(chart.data.labels).toEqual(['Aug 2026', 'Sep 2026', 'Oct 2026']);
    expect(chart.data.datasets[0].data).toEqual([1000, 5800, 7750]);
    expect(footer([{ dataIndex: 1 }])).toEqual(['Assets $6,000.00', 'Owed on cards $200.00']);
  });

  it('says where to start when no balance is entered', async () => {
    await load({
      ...report,
      assets: 0,
      liabilities: 0,
      netWorth: 0,
      months: [],
      accounts: report.accounts.map((a) => ({ ...a, balance: null, balanceDate: null })),
    });

    expect(root().textContent).toContain('No balances entered yet.');
    expect(root().querySelector('a[href="/money/accounts"]')).not.toBeNull();
  });
});
