import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TodayComponent } from './today.component';
import { DataChangesService } from '../../core/data/data-changes.service';
import { TodayCard, TodayDto } from '../../core/models/outputs/today-output-dto';
import { setAmountsHidden } from '../../shared/utils/privacy';
import { HIDDEN_AMOUNT } from '../../shared/utils/format';

function tile(card: Partial<TodayCard> & Pick<TodayCard, 'id' | 'kind' | 'title'>): TodayCard {
  return {
    module: 'Money',
    type: 'Tile',
    value: null,
    text: null,
    values: {},
    severity: 'Neutral',
    trend: null,
    link: null,
    ...card,
  };
}

function attention(card: Partial<TodayCard> & Pick<TodayCard, 'id' | 'kind' | 'text'>): TodayCard {
  return tile({ title: '', severity: 'Warning', ...card, type: 'Attention' });
}

/** A complete answer, as `GET /api/today` gives it (T08). */
function completeAnswer(): TodayDto {
  return {
    date: '2026-10-13',
    generatedAt: '2026-10-13T19:22:00Z',
    modules: [{ module: 'Money', status: 'Complete' }],
    cards: [
      tile({
        id: 'money.spent-this-month',
        kind: 'spent',
        title: 'Spent this month',
        value: { type: 'Money', number: 1234.5 },
        text: '{difference} under a usual month by now',
        values: { difference: { type: 'Money', number: 200 } },
        severity: 'Good',
        trend: 'Down',
      }),
      tile({
        id: 'money.left-over-this-month',
        kind: 'left-over',
        title: 'Left over this month',
        value: { type: 'Money', number: 800 },
        text: 'Income less spending so far',
        severity: 'Good',
      }),
      tile({
        id: 'money.net-worth',
        kind: 'net-worth',
        title: 'Net worth',
        value: { type: 'Money', number: 15000 },
        text: '+{change} since last month',
        values: { change: { type: 'Money', number: 250 } },
        severity: 'Good',
        trend: 'Up',
        link: '/money/net-worth',
      }),
      tile({
        id: 'money.budgets',
        kind: 'budgets',
        title: 'Budgets',
        value: { type: 'Text', text: '1 of 3 over' },
        text: 'Review your budgets',
        severity: 'Bad',
        link: '/money/budgets',
      }),
      attention({
        id: 'money.budget-over.b1',
        kind: 'budget-over',
        text: '{budget} is over its limit ({used} used)',
        values: { budget: { type: 'Text', text: 'Food' }, used: { type: 'Percent', number: 121 } },
        severity: 'Bad',
        link: '/money/budgets',
      }),
      attention({
        id: 'money.statements-behind.a1',
        kind: 'statements-behind',
        text: "{account}: statements reach {reach}. Import last month's",
        values: {
          account: { type: 'Text', text: 'Chequing' },
          reach: { type: 'Date', date: '2026-08-31' },
        },
        link: '/money/transactions',
      }),
      attention({
        id: 'money.unsorted',
        kind: 'unsorted',
        text: '{count} transactions are in Other because no rule names their merchants',
        values: { count: { type: 'Count', number: 4 } },
        link: '/money/rules#unsorted',
      }),
    ],
  };
}

describe('TodayComponent', () => {
  let fixture: ComponentFixture<TodayComponent>;
  let http: HttpTestingController;

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
    fixture = TestBed.createComponent(TodayComponent);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });

  afterEach(() => {
    http.verify();
    setAmountsHidden(false);
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const tileLabels = () =>
    Array.from(root().querySelectorAll('app-stat-card')).map((card) =>
      card.querySelector('p')!.textContent!.trim(),
    );
  const placeholders = () =>
    Array.from(root().querySelectorAll('.placeholder-card')).map((card) =>
      card.getAttribute('data-module'),
    );

  async function answer(body: TodayDto, url = '/api/today'): Promise<void> {
    http.expectOne(url).flush(body);
    await fixture.whenStable();
  }

  /** Clicks a button. No `whenStable`: the request that the click starts keeps the page busy until it gets its answer. */
  function clickButton(label: string): void {
    const button = Array.from(root().querySelectorAll('button')).find((b) =>
      b.textContent!.includes(label),
    )!;
    button.click();
    TestBed.tick();
  }

  it('shows the Money tiles first, then the "Needs attention" list, then the modules to come', async () => {
    await answer(completeAnswer());

    expect(tileLabels()).toEqual([
      'Spent this month',
      'Left over this month',
      'Net worth',
      'Budgets',
    ]);
    const spent = root().querySelector('[data-card="money.spent-this-month"]')!;
    expect(spent.textContent).toContain('$1,234.50');
    expect(spent.textContent).toContain('$200.00 under a usual month by now');
    expect(spent.querySelector('.text-success')).not.toBeNull();
    // Spent and left over have no link, as on the Money dashboard.
    expect(spent.querySelector('a')).toBeNull();

    const netWorth = root().querySelector('a[href="/money/net-worth"]')!;
    expect(netWorth.textContent).toContain('$15,000.00');
    expect(netWorth.textContent).toContain('+$250.00 since last month');
    const budgets = root().querySelector('[data-card="money.budgets"] a[href="/money/budgets"]')!;
    expect(budgets.textContent).toContain('1 of 3 over');
    expect(budgets.querySelector('.text-danger')).not.toBeNull();
    expect(root().querySelector('a[href="/money"]')!.textContent).toContain('Open Money');

    const items = Array.from(root().querySelectorAll('.attention li'));
    expect(items.map((item) => item.textContent!.trim())).toEqual([
      'Food is over its limit (121% used)',
      "Chequing: statements reach Aug 31, 2026. Import last month's",
      '4 transactions are in Other because no rule names their merchants',
    ]);
    expect(items.map((item) => item.querySelector('a')!.getAttribute('href'))).toEqual([
      '/money/budgets',
      '/money/transactions',
      '/money/rules#unsorted',
    ]);
    expect(items[0].querySelector('[data-severity="Bad"]')).not.toBeNull();

    expect(root().querySelector('[data-module-status]')).toBeNull();
    expect(placeholders()).toEqual(['documents', 'home', 'people', 'journal', 'tasks']);
    expect(root().textContent).toContain('Tuesday, October 13');
  });

  it('shows no "Needs attention" list when nothing needs a look', async () => {
    const body = completeAnswer();
    body.cards = body.cards.filter((card) => card.type === 'Tile');
    await answer(body);

    expect(tileLabels().length).toBe(4);
    expect(root().querySelector('.attention')).toBeNull();
  });

  it('notes a Partial module, and keeps its other tiles', async () => {
    const body = completeAnswer();
    body.modules = [{ module: 'Money', status: 'Partial' }];
    body.cards[0] = tile({
      id: 'money.spent-this-month',
      kind: 'spent',
      title: 'Spent this month',
      text: 'Could not load this',
    });
    await answer(body);

    expect(root().querySelector('[data-module-status="money"]')!.textContent).toContain(
      'Some Money figures could not load.',
    );
    const spent = root().querySelector('[data-card="money.spent-this-month"]')!;
    expect(spent.textContent).toContain('—');
    expect(spent.textContent).toContain('Could not load this');
    expect(tileLabels().length).toBe(4);
  });

  it('shows a Failed module with a retry, and keeps the other cards', async () => {
    await answer({
      date: '2026-10-13',
      generatedAt: '2026-10-13T19:22:00Z',
      modules: [
        { module: 'Money', status: 'Failed' },
        { module: 'Documents', status: 'Complete' },
      ],
      cards: [
        tile({
          id: 'documents.expiring',
          module: 'Documents',
          kind: 'expiring',
          title: 'Expiring soon',
          value: { type: 'Count', number: 2 },
        }),
      ],
    });

    expect(root().textContent).toContain('Money could not load.');
    expect(tileLabels()).toEqual(['Expiring soon']);
    // Documents now has cards, so it is not a placeholder any more.
    expect(placeholders()).toEqual(['home', 'people', 'journal', 'tasks']);

    clickButton('Retry');
    await answer(completeAnswer(), '/api/today?refresh=true');
    expect(tileLabels().length).toBe(4);
  });

  it('shows an error when the request fails, and loads again on retry', async () => {
    http.expectOne('/api/today').flush(null, { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();

    expect(root().textContent).toContain('Could not load Today.');
    expect(placeholders().length).toBe(5);

    clickButton('Retry');
    await answer(completeAnswer(), '/api/today?refresh=true');
    expect(root().textContent).not.toContain('Could not load Today.');
    expect(tileLabels().length).toBe(4);
  });

  it('asks for a new answer on Refresh, and keeps the cards while it loads', async () => {
    await answer(completeAnswer());

    clickButton('Refresh');
    const request = http.expectOne('/api/today?refresh=true');
    expect(tileLabels().length).toBe(4);

    const body = completeAnswer();
    body.cards[2] = { ...body.cards[2], value: { type: 'Money', number: 16000 } };
    request.flush(body);
    await fixture.whenStable();
    expect(root().querySelector('a[href="/money/net-worth"]')!.textContent).toContain('$16,000.00');
  });

  it('asks for a new answer when the data changes from this app', async () => {
    await answer(completeAnswer());

    TestBed.inject(DataChangesService).changed();
    TestBed.tick();
    await answer(completeAnswer(), '/api/today?refresh=true');
  });

  it('hides the amounts in privacy mode', async () => {
    setAmountsHidden(true);
    await answer(completeAnswer());

    const spent = root().querySelector('[data-card="money.spent-this-month"]')!;
    expect(spent.textContent).toContain(HIDDEN_AMOUNT);
    expect(spent.textContent).not.toContain('1,234.50');
    expect(root().textContent).not.toContain('$250.00');
    expect(root().querySelector('[data-card="money.budgets"]')!.textContent).toContain(
      '1 of 3 over',
    );
  });

  it('gives no link for a path outside the app', async () => {
    const body = completeAnswer();
    body.cards = [
      attention({ id: 'x.1', kind: 'other', text: 'Outside', link: 'https://example.com/' }),
      attention({ id: 'x.2', kind: 'other', text: 'Other host', link: '//example.com/a' }),
    ];
    await answer(body);

    expect(root().querySelectorAll('.attention a').length).toBe(0);
    expect(root().querySelector('.attention')!.textContent).toContain('Outside');
  });
});
