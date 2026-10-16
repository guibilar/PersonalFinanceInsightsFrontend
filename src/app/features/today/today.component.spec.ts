import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TodayComponent, displayName, greetingFor } from './today.component';
import { DataChangesService } from '../../core/data/data-changes.service';
import { TodayCard, TodayDto } from '../../core/models/outputs/today-output-dto';
import { setAmountsHidden } from '../../shared/utils/privacy';
import { HIDDEN_AMOUNT } from '../../shared/utils/format';
import { TaskDoneService } from '../tasks/task-done.service';
import { TASK_ID, testTask } from '../../testing/test-tasks';

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
        link: '/money/transactions#import',
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
    // At a glance: each tile in its module's colour (styles.scss, data-accent).
    expect(spent.getAttribute('data-accent')).toBe('money');

    const items = Array.from(root().querySelectorAll('.attention li'));
    expect(items.map((item) => item.textContent!.trim())).toEqual([
      'Food is over its limit (121% used)',
      "Chequing: statements reach Aug 31, 2026. Import last month's",
      '4 transactions are in Other because no rule names their merchants',
    ]);
    expect(items.map((item) => item.querySelector('a')!.getAttribute('href'))).toEqual([
      '/money/budgets',
      '/money/transactions#import',
      '/money/rules#unsorted',
    ]);
    expect(items[0].querySelector('[data-severity="Bad"]')).not.toBeNull();

    expect(root().querySelector('[data-module-status]')).toBeNull();
    // Every module is active (T21): no placeholder for a module to come.
    expect(placeholders()).toEqual([]);
    expect(root().textContent).toContain('Tuesday, October 13');
  });

  it('has a bell with the count of the items that need attention, which goes to the list (T69)', async () => {
    await answer(completeAnswer());

    const bell = root().querySelector<HTMLButtonElement>('[data-testid="bell"]')!;
    expect(bell.getAttribute('aria-label')).toBe('3 items need attention');
    expect(bell.textContent!.trim()).toBe('3');
    const heading = root().querySelector<HTMLElement>('#today-attention')!;
    heading.scrollIntoView = () => undefined;
    bell.click();
    expect(document.activeElement).toBe(heading);
  });

  it('keeps the fragment of a link, so a statement item opens the import', async () => {
    await answer(completeAnswer());
    const card = completeAnswer().cards.find((c) => c.kind === 'statements-behind')!;

    const tree = fixture.componentInstance.linkOf(card)!;

    expect(tree.fragment).toBe('import');
    expect(tree.toString()).toBe('/money/transactions#import');
  });

  it('shows no "Needs attention" list when nothing needs a look', async () => {
    const body = completeAnswer();
    body.cards = body.cards.filter((card) => card.type === 'Tile');
    await answer(body);

    expect(tileLabels().length).toBe(4);
    expect(root().querySelector('.attention')).toBeNull();
    const bell = root().querySelector<HTMLButtonElement>('[data-testid="bell"]')!;
    expect(bell.disabled).toBe(true);
    expect(bell.getAttribute('aria-label')).toBe('Nothing needs attention');
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
    // Every module is active (T21): no placeholder for a module to come.
    expect(placeholders()).toEqual([]);
    expect(
      root().querySelector('[data-card="documents.expiring"]')!.getAttribute('data-accent'),
    ).toBe('documents');

    clickButton('Retry');
    await answer(completeAnswer(), '/api/today?refresh=true');
    expect(tileLabels().length).toBe(4);
  });

  it('shows an error when the request fails, and loads again on retry', async () => {
    http.expectOne('/api/today').flush(null, { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();

    expect(root().textContent).toContain('Could not load Today.');
    expect(placeholders().length).toBe(0);

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

  it('shows the Tasks tile, and its new count after a task is marked done', async () => {
    const withTasks = (dueToday: number) => {
      const body = completeAnswer();
      body.modules.push({ module: 'Tasks', status: 'Complete' });
      body.cards.push(
        tile({
          id: 'tasks.due-today',
          module: 'Tasks',
          kind: 'due-today',
          title: 'Tasks',
          value: { type: 'Count', number: dueToday },
          text: '{overdue} overdue',
          values: { overdue: { type: 'Count', number: 1 } },
          severity: 'Warning',
          link: '/tasks',
        }),
      );
      return body;
    };
    await answer(withTasks(1));

    const card = () => root().querySelector('[data-card="tasks.due-today"]')!;
    const count = () => card().querySelector('.stat-value')!.textContent!.trim();
    expect(card().querySelector('a')!.getAttribute('href')).toBe('/tasks');
    expect(count()).toBe('1');
    expect(card().textContent).toContain('1 overdue');

    TestBed.inject(TaskDoneService).done(testTask());
    http
      .expectOne({ method: 'POST', url: `/api/tasks/${TASK_ID}/done` })
      .flush(testTask({ status: 'Done', doneAt: '2026-10-13T15:00:00Z' }));
    TestBed.tick();
    await answer(withTasks(0), '/api/today?refresh=true');

    expect(count()).toBe('0');
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

  it('opens the document of a Documents "expires soon" item', async () => {
    const body = completeAnswer();
    body.modules.push({ module: 'Documents', status: 'Complete' });
    body.cards = [
      attention({
        id: 'documents.expiring.d1',
        module: 'Documents',
        kind: 'expiring',
        text: 'Dishwasher warranty expires soon',
        link: '/documents/d1',
      }),
    ];
    await answer(body);

    const link = root().querySelector('.attention a')!;
    expect(link.textContent).toContain('Dishwasher warranty expires soon');
    expect(link.getAttribute('href')).toBe('/documents/d1');
  });

  it('shows no tiles for a module with only "Needs attention" items, and puts System last (T81)', async () => {
    const body = completeAnswer();
    body.modules = [
      { module: 'System', status: 'Complete' },
      { module: 'Money', status: 'Complete' },
      { module: 'People', status: 'Complete' },
    ];
    body.cards.push(
      attention({
        id: 'system.broker-down',
        kind: 'broker-down',
        text: 'No event broker since {since}',
        values: { since: { type: 'Date', date: '2026-10-13' } },
        module: 'System',
      }),
      attention({
        id: 'people.reach-out.p1',
        kind: 'reach-out',
        text: 'Reach out to Marco',
        module: 'People',
        link: '/people/p1',
      }),
    );
    await answer(body);

    // Only Money has tiles; each tile has its module's warm colour (styles.scss, data-accent).
    const accents = Array.from(root().querySelectorAll('.glance-tile')).map((t) =>
      t.getAttribute('data-accent'),
    );
    expect(new Set(accents)).toEqual(new Set(['money']));
    const system = root().querySelector('[data-card="system.broker-down"]')!;
    expect(system.querySelector('a')).toBeNull();
    expect(root().querySelector('[data-card="people.reach-out.p1"] a')!.getAttribute('href')).toBe(
      '/people/p1',
    );
  });

  it('says which module did not load, also one without tiles, and System after the others', async () => {
    const body = completeAnswer();
    body.modules = [
      { module: 'System', status: 'Failed' },
      { module: 'Money', status: 'Complete' },
    ];
    await answer(body);

    const problems = Array.from(root().querySelectorAll('[data-module-status]')).map((e) =>
      e.getAttribute('data-module-status'),
    );
    expect(problems).toEqual(['system']);
    expect(root().textContent).toContain('System could not load.');
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

  function withAgenda(): TodayDto {
    const body = completeAnswer();
    body.agenda = {
      complete: true,
      today: [
        {
          id: 'tasks.task-due.t1',
          module: 'Tasks',
          kind: 'task-due',
          title: 'Water the plants',
          text: null,
          allDay: true,
          startDate: '2026-10-13',
          endDate: '2026-10-13',
          startsAt: null,
          endsAt: null,
          link: '/tasks/t1',
          eventId: null,
          done: false,
        },
        {
          id: 'calendar.event.e1',
          module: 'Calendar',
          kind: 'event',
          title: 'Dinner with Ana',
          text: "Luigi's",
          allDay: false,
          startDate: '2026-10-13',
          endDate: '2026-10-13',
          startsAt: '2026-10-14T00:30:00Z',
          endsAt: '2026-10-14T02:30:00Z',
          link: '/calendar?event=e1',
          eventId: 'e1',
          done: null,
        },
      ],
      upcoming: [
        {
          id: 'people.birthday.p1.2026',
          module: 'People',
          kind: 'birthday',
          title: "Ana's birthday",
          text: 'Turns 36',
          allDay: true,
          startDate: '2026-10-15',
          endDate: '2026-10-15',
          startsAt: null,
          endsAt: null,
          link: '/people/p1',
          eventId: null,
          done: null,
        },
      ],
    };
    body.memories = [
      {
        module: 'Journal',
        kind: 'journal-entry',
        yearsAgo: 1,
        day: '2025-10-13',
        text: 'First night in the new place.',
        link: '/journal?day=2025-10-13',
      },
    ];
    return body;
  }

  it('shows your day first: the whole-day task, the event with its time, and what comes up (T106)', async () => {
    await answer(withAgenda());

    expect(root().querySelector('[data-testid="day-summary"]')!.textContent!.trim()).toBe(
      '2 things today, and a birthday this week.',
    );
    const rows = Array.from(root().querySelectorAll('[data-testid="agenda-today"] li'));
    expect(rows.map((r) => r.querySelector('.agenda-title')!.textContent!.trim())).toEqual([
      'Water the plants',
      'Dinner with Ana',
    ]);
    expect(rows[0].getAttribute('data-accent')).toBe('tasks');
    expect(rows[1].querySelector('a')!.getAttribute('href')).toBe('/calendar?event=e1');
    expect(rows[1].querySelector('.agenda-time')!.textContent).toMatch(/\d:30 [AP]M/);
    const upcoming = root().querySelector('[data-testid="agenda-upcoming"]')!;
    expect(upcoming.textContent).toContain("Ana's birthday");
    expect(upcoming.querySelector('a')!.getAttribute('href')).toBe('/people/p1');

    const memory = root().querySelector('[data-testid="memories"] a')!;
    expect(memory.textContent).toContain('1 year ago · Oct 13, 2025');
    expect(memory.getAttribute('href')).toBe('/journal?day=2025-10-13');
  });

  it('ticks a task of today as done, then loads again', async () => {
    await answer(withAgenda());

    root().querySelector<HTMLInputElement>('[data-testid="done-tasks.task-due.t1"]')!.click();
    TestBed.tick();
    const done = http.expectOne((r) => r.method === 'POST' && r.url === '/api/tasks/t1/done');
    done.flush({});
    TestBed.tick();
    await answer(withAgenda(), '/api/today?refresh=true');

    expect(root().querySelector('[data-testid="agenda-today"] li')!.classList).toContain('done');
  });

  it('jots a note down for the Inbox', async () => {
    await answer(withAgenda());

    const input = root().querySelector<HTMLInputElement>('[data-testid="jot-text"]')!;
    input.value = '  Buy furnace filters ';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    root().querySelector<HTMLButtonElement>('[data-testid="jot-save"]')!.click();
    TestBed.tick();
    const add = http.expectOne((r) => r.method === 'POST' && r.url === '/api/inbox');
    expect(add.request.body).toEqual({ text: 'Buy furnace filters' });
    add.flush({ id: 'n1', text: 'Buy furnace filters' });
    TestBed.tick();
    await answer(withAgenda(), '/api/today?refresh=true');

    expect(input.value).toBe('');
  });

  it('says when the calendar did not load, or the day is free', async () => {
    await answer(completeAnswer());
    expect(root().querySelector('[data-testid="agenda-failed"]')).not.toBeNull();

    clickButton('Refresh');
    const free = withAgenda();
    free.agenda = { complete: true, today: [], upcoming: [] };
    free.memories = [];
    await answer(free, '/api/today?refresh=true');
    expect(root().querySelector('[data-testid="agenda-empty"]')!.textContent).toContain(
      'Nothing planned today',
    );
    expect(root().querySelector('[data-testid="memories"]')).toBeNull();
  });
});

describe('the Today greeting', () => {
  it('greets by the time of day', () => {
    expect([3, 5, 11, 12, 17, 18, 23].map(greetingFor)).toEqual([
      'Good night',
      'Good morning',
      'Good morning',
      'Good afternoon',
      'Good afternoon',
      'Good evening',
      'Good evening',
    ]);
  });

  it('uses the first name of the user name', () => {
    expect(['alex', 'guilherme.bilar', ' maria_s ', 'jo@home', ''].map(displayName)).toEqual([
      'Alex',
      'Guilherme',
      'Maria',
      'Jo',
      '',
    ]);
  });
});
