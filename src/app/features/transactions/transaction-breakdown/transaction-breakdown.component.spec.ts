import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionBreakdownComponent } from './transaction-breakdown.component';
import {
  BreakdownInterval,
  BreakdownPeriodDto,
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
      providers: [provideZonelessChangeDetection()],
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
});
