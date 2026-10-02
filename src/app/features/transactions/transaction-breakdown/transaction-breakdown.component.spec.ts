import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TransactionBreakdownComponent } from './transaction-breakdown.component';
import {
  BreakdownInterval,
  BreakdownPeriodDto,
  MerchantTotalDto,
  TransactionBreakdownOutputDto,
} from '../../../core/models/outputs/transaction-breakdown-output-dto';
import { TEST_BREAKDOWN } from '../../../testing/test-breakdown';

describe('TransactionBreakdownComponent', () => {
  let fixture: ComponentFixture<TransactionBreakdownComponent>;
  let opened: boolean[];
  let intervals: BreakdownInterval[];
  let picked: BreakdownPeriodDto[];

  const root = () => fixture.nativeElement as HTMLElement;
  // innerText: the totals are separate items laid out side by side.
  const text = (selector: string) =>
    root().querySelector<HTMLElement>(selector)!.innerText.replace(/\s+/g, ' ').trim();

  async function create(
    breakdown: TransactionBreakdownOutputDto | undefined = TEST_BREAKDOWN,
    open = false,
  ) {
    TestBed.configureTestingModule({
      imports: [TransactionBreakdownComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    fixture = TestBed.createComponent(TransactionBreakdownComponent);
    fixture.componentRef.setInput('breakdown', breakdown);
    fixture.componentRef.setInput('open', open);
    opened = [];
    intervals = [];
    picked = [];
    fixture.componentInstance.openChange.subscribe((value) => opened.push(value));
    fixture.componentInstance.intervalChange.subscribe((value) => intervals.push(value));
    fixture.componentInstance.periodPicked.subscribe((value) => picked.push(value));
    await fixture.whenStable();
  }

  it('totals what the list shows, and opens the chart on demand', async () => {
    await create();

    expect(text('[aria-live]')).toBe('6 transactions $190.00 spent $10.00 refunded');
    expect(root().querySelector('#breakdown-panel')).toBeNull();
    root().querySelector<HTMLButtonElement>('[aria-controls=breakdown-panel]')!.click();

    expect(opened).toEqual([true]);
  });

  it('says what came in when there was any', async () => {
    await create({ ...TEST_BREAKDOWN, spending: 0, refunds: 0, income: 2500, count: 1 });

    expect(text('[aria-live]')).toBe('1 transaction $2,500.00 received');
  });

  it('gives the average over the finished periods, and the biggest one', async () => {
    await create(TEST_BREAKDOWN, true);

    expect(text('#breakdown-panel p')).toBe(
      'Average $60.00 per month · over 2 months · Highest Jul 2026, $120.00',
    );
    expect(root().querySelector('canvas')).not.toBeNull();
  });

  it('switches the interval', async () => {
    await create(TEST_BREAKDOWN, true);
    const buttons = Array.from(
      root().querySelectorAll<HTMLButtonElement>('[aria-label=Per] button'),
    );

    expect(buttons.map((b) => [b.textContent!.trim(), b.getAttribute('aria-pressed')])).toEqual([
      ['Week', 'false'],
      ['Month', 'true'],
      ['Quarter', 'false'],
      ['Year', 'false'],
    ]);
    buttons[0].click();
    expect(intervals).toEqual(['Week']);
  });

  it('lists where the spending went, when it went to more than one place', async () => {
    await create(TEST_BREAKDOWN, true);
    const merchants = Array.from(root().querySelectorAll<HTMLElement>('#breakdown-panel li')).map(
      (li) => li.innerText.replace(/\s+/g, ' ').trim(),
    );

    expect(merchants).toEqual(['NO FRILLS $150.00 · 4 times', 'SAFEWAY $40.00 · 2 times']);

    fixture.componentRef.setInput('breakdown', {
      ...TEST_BREAKDOWN,
      topMerchants: [TEST_BREAKDOWN.topMerchants[0]],
    });
    await fixture.whenStable();
    expect(root().querySelector('#breakdown-panel li')).toBeNull();
  });

  it('says so when nothing matches', async () => {
    await create({ ...TEST_BREAKDOWN, count: 0, spending: 0, refunds: 0, periods: [] }, true);

    expect(root().textContent).toContain('No transactions match these filters.');
    expect(root().querySelector('canvas')).toBeNull();
  });

  it('says so too for dates with nothing in them, rather than charting their empty periods', async () => {
    const empty = TEST_BREAKDOWN.periods.map((p) => ({
      ...p,
      count: 0,
      spending: 0,
      income: 0,
      cumulativeSpending: 0,
      cumulativeIncome: 0,
    }));
    await create({ ...TEST_BREAKDOWN, count: 0, spending: 0, refunds: 0, periods: empty }, true);

    expect(root().textContent).toContain('No transactions match these filters.');
    expect(root().querySelector('canvas')).toBeNull();
    expect(root().textContent).not.toContain('Average');
  });

  it('offers a retry when the totals could not be loaded', async () => {
    await create();
    fixture.componentRef.setInput('breakdown', undefined);
    fixture.componentRef.setInput('failed', true);
    let retried = 0;
    fixture.componentInstance.retry.subscribe(() => retried++);
    await fixture.whenStable();

    root().querySelector<HTMLButtonElement>('[aria-live] button')!.click();

    expect(text('[aria-live]')).toContain('Could not total these transactions.');
    expect(retried).toBe(1);
  });

  describe('more merchants', () => {
    const store = (n: number): MerchantTotalDto => ({
      name: `STORE ${n}`,
      count: 1,
      spending: 200 - n,
    });
    const stores = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, i) => store(from + i));
    const withTwenty = { ...TEST_BREAKDOWN, topMerchants: stores(1, 8), merchantCount: 20 };
    const names = () =>
      Array.from(root().querySelectorAll<HTMLElement>('#breakdown-panel li span[title]')).map(
        (s) => s.title,
      );
    const button = (label: string) =>
      Array.from(root().querySelectorAll<HTMLButtonElement>('#breakdown-panel button')).find(
        (b) => b.textContent!.trim() === label,
      );
    let http: HttpTestingController;

    beforeEach(async () => {
      await create(withTwenty, true);
      fixture.componentRef.setInput('criteria', { description: 'store', startDate: '2026-09-01' });
      http = TestBed.inject(HttpTestingController);
      await fixture.whenStable();
    });

    afterEach(() => http.verify());

    it('loads the next pages with the same criteria, until there are none left', async () => {
      expect(text('#breakdown-panel .d-flex.flex-wrap.mt-2')).toContain('8 of 20 merchants');

      button('Show 8 more')!.click();
      const request = http.expectOne({ method: 'POST', url: '/api/Reports/merchants' });
      expect(request.request.body).toEqual({
        description: 'store',
        startDate: '2026-09-01',
        page: 2,
        pageSize: 8,
      });
      request.flush({ items: stores(9, 16), page: 2, pageSize: 8, totalCount: 20 });
      await fixture.whenStable();

      expect(names().length).toBe(16);
      button('Show 4 more')!.click();
      expect(http.expectOne('/api/Reports/merchants').request.body.page).toBe(3);
    });

    it('shows fewer again, and starts over for a new breakdown', async () => {
      button('Show 8 more')!.click();
      http.expectOne('/api/Reports/merchants').flush({ items: stores(9, 16) });
      await fixture.whenStable();

      button('Show fewer')!.click();
      await fixture.whenStable();
      expect(names()).toEqual(stores(1, 8).map((m) => m.name));

      button('Show 8 more')!.click();
      http.expectOne('/api/Reports/merchants').flush({ items: stores(9, 16) });
      fixture.componentRef.setInput('breakdown', { ...withTwenty });
      await fixture.whenStable();
      expect(names().length).toBe(8);
      expect(button('Show fewer')).toBeUndefined();
    });

    it('keeps what it has and says so when loading more fails', async () => {
      button('Show 8 more')!.click();
      http.expectOne('/api/Reports/merchants').flush(null, { status: 500, statusText: 'Error' });
      await fixture.whenStable();

      expect(names().length).toBe(8);
      expect(text('#breakdown-panel [role=alert]')).toBe('Could not load more merchants.');
      expect(button('Show 8 more')!.disabled).toBe(false);
    });

    it('offers nothing more when every merchant is shown', async () => {
      fixture.componentRef.setInput('breakdown', TEST_BREAKDOWN);
      await fixture.whenStable();

      expect(button('Show 8 more')).toBeUndefined();
      expect(root().textContent).not.toContain('merchants');
    });
  });
});
