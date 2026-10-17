import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { CalendarPageComponent, importSummary } from './calendar-page.component';
import { provideReadOnlyUser } from '../../../testing/test-auth';
import {
  testCalendar,
  testCalendarEvent,
  testCalendarItem,
  testImportResult,
} from '../../../testing/test-calendar';

@Component({ template: '' })
class BlankComponent {}

describe('CalendarPageComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const root = () => document.body;
  const text = (el: Element) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
  const byId = <T extends HTMLElement = HTMLElement>(id: string) =>
    root().querySelector<T>(`[data-testid="${id}"]`);

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  async function start(
    url = '/calendar?month=2026-10&day=2026-10-20',
    extra: unknown[] = [],
  ): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'calendar', component: CalendarPageComponent },
          { path: 'tasks/:id', component: BlankComponent },
        ]),
        provideLocationMocks(),
        ...(extra as []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, CalendarPageComponent);
    TestBed.tick();
  }

  const task = testCalendarItem({
    id: 'tasks.task-due.t1',
    module: 'Tasks',
    kind: 'task-due',
    title: 'Change the furnace filter',
    text: null,
    allDay: true,
    startDate: '2026-10-20',
    endDate: '2026-10-20',
    startsAt: null,
    endsAt: null,
    link: '/tasks/t1',
    eventId: null,
    done: false,
  });

  function answerRange(from: string, to: string, items = [task, testCalendarItem()]): void {
    const request = http.expectOne((r) => r.url === '/api/calendar');
    expect(request.request.params.get('from')).toBe(from);
    expect(request.request.params.get('to')).toBe(to);
    request.flush(testCalendar(items, { from, to }));
  }

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
    document.querySelectorAll('dialog').forEach((d) => d.remove());
  });

  it('shows the month in whole weeks, with the items in their days, and the chosen day below', async () => {
    await start();
    answerRange('2026-09-27', '2026-10-31');
    await settle();

    expect(text(byId('month-title')!)).toBe('October 2026');
    const cell = byId('day-2026-10-20')!;
    expect(cell.getAttribute('aria-selected')).toBe('true');
    expect(cell.getAttribute('aria-label')).toBe('Tuesday, October 20, 2 items');
    expect(cell.querySelectorAll('.chip').length).toBe(2);
    // The whole-day task comes first, as the server sends it.
    const rows = Array.from(byId('day-items')!.querySelectorAll('button.item'));
    expect(rows.map((r) => r.querySelector('.item-title')!.textContent!.trim())).toEqual([
      'Change the furnace filter',
      'Dentist',
    ]);
    expect(rows[0].getAttribute('data-accent')).toBe('tasks');
    expect(text(rows[0])).toContain('Tasks');
    expect(text(rows[1])).toContain('Main St 4');
    expect(byId('day-2026-10-16')!.classList.contains('is-today')).toBe(true);
  });

  it('moves a month, and a tap on a day shows its items', async () => {
    await start();
    answerRange('2026-09-27', '2026-10-31');
    await settle();

    byId('next')!.click();
    await settle();
    answerRange('2026-11-01', '2026-12-05', []);
    await settle();
    expect(text(byId('month-title')!)).toBe('November 2026');

    byId('day-2026-11-03')!.click();
    await settle();
    expect(TestBed.inject(Router).url).toBe('/calendar?month=2026-11&day=2026-11-03');
    expect(text(byId('day-empty')!)).toBe('Nothing on this day.');
  });

  it('opens the page of another module, and the dialog of an event', async () => {
    await start();
    answerRange('2026-09-27', '2026-10-31');
    await settle();

    const rows = Array.from(byId('day-items')!.querySelectorAll<HTMLButtonElement>('button.item'));
    rows[1].click();
    http.expectOne('/api/calendar/events/ev1').flush(testCalendarEvent());
    await settle();
    expect(byId<HTMLInputElement>('event-title')!.value).toBe('Dentist');
    expect(byId<HTMLInputElement>('event-location')!.value).toBe('Main St 4');

    rows[0].click();
    await settle();
    expect(TestBed.inject(Router).url).toBe('/tasks/t1');
  });

  it('adds an event with a time and a weekly repeat until a day', async () => {
    await start();
    answerRange('2026-09-27', '2026-10-31');
    await settle();

    byId('add-on-day')!.click();
    await settle();
    const title = byId<HTMLInputElement>('event-title')!;
    title.value = 'Swim';
    title.dispatchEvent(new Event('input'));
    expect(byId<HTMLInputElement>('event-start-date')!.value).toBe('2026-10-20');
    const repeat = byId<HTMLSelectElement>('event-repeat')!;
    repeat.value = 'FREQ=WEEKLY';
    repeat.dispatchEvent(new Event('change'));
    await settle();
    const until = byId<HTMLInputElement>('event-until')!;
    until.value = '2026-12-31';
    until.dispatchEvent(new Event('input'));
    byId('event-save')!.click();

    const request = http.expectOne((r) => r.method === 'POST' && r.url === '/api/calendar/events');
    expect(request.request.body).toEqual(
      expect.objectContaining({
        title: 'Swim',
        allDay: false,
        startsAt: new Date('2026-10-20T09:00:00').toISOString(),
        endsAt: new Date('2026-10-20T10:00:00').toISOString(),
        repeat: 'FREQ=WEEKLY;UNTIL=20261231T235959Z',
      }),
    );
    request.flush(testCalendarEvent({ id: 'ev9', title: 'Swim' }));
    await settle();
    // The calendar loads again.
    answerRange('2026-09-27', '2026-10-31');
    await settle();
    expect(byId('event-form')).toBeNull();
  });

  it('does not save a repeat that ends before the first day', async () => {
    await start();
    answerRange('2026-09-27', '2026-10-31');
    await settle();

    byId('add-on-day')!.click();
    await settle();
    const title = byId<HTMLInputElement>('event-title')!;
    title.value = 'Swim';
    title.dispatchEvent(new Event('input'));
    const repeat = byId<HTMLSelectElement>('event-repeat')!;
    repeat.value = 'FREQ=WEEKLY';
    repeat.dispatchEvent(new Event('change'));
    await settle();
    const until = byId<HTMLInputElement>('event-until')!;
    until.value = '2026-10-31';
    until.dispatchEvent(new Event('input'));
    // The first day moves past it afterwards.
    const startDate = byId<HTMLInputElement>('event-start-date')!;
    startDate.value = '2026-11-05';
    startDate.dispatchEvent(new Event('input'));
    startDate.dispatchEvent(new Event('change'));
    byId('event-save')!.click();
    await settle();

    http.expectNone((r) => r.method === 'POST' && r.url === '/api/calendar/events');
    expect(text(byId('event-error')!)).toBe('The repeat cannot end before the first day.');
  });

  it('previews an .ics file, then imports it', async () => {
    await start();
    answerRange('2026-09-27', '2026-10-31');
    await settle();

    const input = byId<HTMLInputElement>('import-file')!;
    const file = new File(['BEGIN:VCALENDAR\nEND:VCALENDAR'], 'yoga.ics', {
      type: 'text/calendar',
    });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const preview = http.expectOne('/api/calendar/import');
    expect(preview.request.body).toEqual({ ics: 'BEGIN:VCALENDAR\nEND:VCALENDAR', dryRun: true });
    preview.flush(testImportResult());
    await settle();

    expect(text(byId('import-summary')!)).toBe('1 event added.');
    expect(Array.from(byId('import-list')!.querySelectorAll('li')).map(text)[1]).toContain(
      'Already there Long weekend',
    );

    byId('import-confirm')!.click();
    const done = http.expectOne('/api/calendar/import');
    expect(done.request.body.dryRun).toBe(false);
    done.flush(testImportResult({ dryRun: false }));
    await settle();
    // It shows the first new event: a new month to load.
    answerRange('2026-09-27', '2026-10-31');
    await settle();
    expect(byId('import-list')).toBeNull();
  });

  it('shows the agenda of the next 60 days, by day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 16, 12));
    await start('/calendar?view=agenda');
    answerRange('2026-10-16', '2026-12-14');
    await settle();

    const sections = Array.from(byId('agenda')!.querySelectorAll('section'));
    expect(sections.map((s) => s.getAttribute('aria-label'))).toEqual(['Tuesday, October 20']);
    expect(sections[0].querySelectorAll('button.item').length).toBe(2);
  });

  it('says which modules did not load, and a read-only user cannot add', async () => {
    await start(undefined, [provideReadOnlyUser()]);
    const request = http.expectOne((r) => r.url === '/api/calendar');
    request.flush(
      testCalendar([], {
        modules: [
          { module: 'Calendar', status: 'Complete' },
          { module: 'Tasks', status: 'Failed' },
        ],
      }),
    );
    await settle();

    expect(text(byId('partial')!)).toBe('Some dates could not load: Tasks.');
    expect(byId('add-event')).toBeNull();
    expect(byId('import')).toBeNull();
  });

  it('sums up an import', () => {
    expect(importSummary(testImportResult({ added: 2, updated: 1, skipped: 1 }))).toBe(
      '2 events added, 1 changed, 1 skipped.',
    );
    expect(importSummary(testImportResult({ added: 0, unchanged: 3 }))).toBe(
      '3 already in the calendar.',
    );
    expect(importSummary(testImportResult({ added: 0, unchanged: 0, events: [] }))).toBe(
      'The file has no events.',
    );
  });
});
