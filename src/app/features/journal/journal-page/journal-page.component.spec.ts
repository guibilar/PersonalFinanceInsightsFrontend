import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { JournalPageComponent } from './journal-page.component';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { JournalSummaryDto } from '../../../core/models/outputs/journal-output-dto';
import { provideReadOnlyUser } from '../../../testing/test-auth';
import {
  JOURNAL_TODAY,
  testEntry,
  testEntrySummary,
  testJournalPage,
  testJournalSummary,
} from '../../../testing/test-journal';

describe('JournalPageComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = (el: Element) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
  const textarea = () => root().querySelector<HTMLTextAreaElement>('[data-testid="entry-text"]')!;
  const button = (id: string) => root().querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  async function start(url = '/journal', extra: unknown[] = []): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'journal', component: JournalPageComponent }]),
        provideLocationMocks(),
        ...(extra as []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, JournalPageComponent);
  }

  async function answer(
    summary: JournalSummaryDto = testJournalSummary(),
    items = [
      testEntrySummary(),
      testEntrySummary({ id: 'e2', day: '2026-10-08', excerpt: 'Rain all day.' }),
    ],
  ): Promise<void> {
    TestBed.tick();
    http.expectOne('/api/journal/summary').flush(summary);
    http.expectOne((r) => r.url === '/api/journal/entries').flush(testJournalPage(items));
    await settle();
  }

  afterEach(() => http.verify());

  it('shows the streak, the week, an empty editor for today, on this day, and the entries', async () => {
    await start();
    await answer();

    expect(text(root().querySelector('[data-testid="streak"]')!)).toBe('6-day streak');
    const days = Array.from(root().querySelectorAll('[data-testid="week"] a'));
    expect(days.length).toBe(7);
    expect(days.filter((d) => d.classList.contains('written')).length).toBe(6);
    expect(days[6].getAttribute('aria-current')).toBe('date');
    expect(days[6].getAttribute('aria-label')).toBe('Saturday, October 10, not written');
    expect(text(root().querySelector('#entry-heading')!)).toBe('Saturday, October 10');
    expect(textarea().value).toBe('');
    expect(button('save')!.disabled).toBe(true);
    expect(button('delete')).toBeNull();

    expect(text(root().querySelector('[data-testid="on-this-day"]')!)).toBe(
      'Oct 10, 2025 · 1 year ago Moved the desk to the window. Much better light.',
    );
    const rows = Array.from(root().querySelectorAll('[data-testid="entries"] a'));
    expect(rows.map(text)).toEqual([
      'Oct 9, 2026 Board game night with Marco.',
      'Oct 8, 2026 Rain all day.',
    ]);
    expect(rows[0].getAttribute('href')).toBe('/journal?day=2026-10-09');
  });

  it("writes today's entry, then everything loads again", async () => {
    await start();
    await answer();
    const changes = TestBed.inject(DataChangesService);
    const before = changes.version();

    textarea().value = '  Long walk by the river.  ';
    textarea().dispatchEvent(new Event('input'));
    await settle();
    button('save')!.click();

    const save = http.expectOne({ method: 'PUT', url: `/api/journal/entries/${JOURNAL_TODAY}` });
    expect(save.request.body).toEqual({ text: 'Long walk by the river.' });
    save.flush(testEntry({ text: 'Long walk by the river.' }));
    await settle();
    expect(changes.version()).toBe(before + 1);
    await answer(
      testJournalSummary({ streak: 7, today: testEntry({ text: 'Long walk by the river.' }) }),
    );
    expect(textarea().value).toBe('Long walk by the river.');
    expect(button('save')!.disabled).toBe(true);
    expect(button('delete')).not.toBeNull();
  });

  it('keeps what is being written when the page loads again after a change elsewhere', async () => {
    await start();
    await answer(testJournalSummary({ today: testEntry({ text: 'Morning.' }) }));
    expect(textarea().value).toBe('Morning.');

    textarea().value = 'Morning. Then a long walk';
    textarea().dispatchEvent(new Event('input'));
    await settle();
    TestBed.inject(DataChangesService).changed();
    await answer(testJournalSummary({ today: testEntry({ text: 'Morning.' }) }));

    expect(textarea().value).toBe('Morning. Then a long walk');
    expect(button('save')!.disabled).toBe(false);
  });

  it('opens an earlier day from the address, and deletes its entry after a confirmation', async () => {
    await start('/journal?day=2026-10-09');
    await answer();
    const entry = http.expectOne('/api/journal/entries/2026-10-09');
    entry.flush(testEntry({ id: 'e1', day: '2026-10-09', text: 'Board game night with Marco.' }));
    await settle();

    expect(text(root().querySelector('#entry-heading')!)).toBe('Friday, October 9');
    expect(textarea().value).toBe('Board game night with Marco.');
    // On this day is for today only.
    expect(root().querySelector('[data-testid="on-this-day"]')).toBeNull();

    button('delete')!.click();
    await settle();
    Array.from(document.querySelectorAll<HTMLButtonElement>('app-confirm-dialog button'))
      .find((b) => b.textContent!.trim() === 'Delete')!
      .click();
    http.expectOne({ method: 'DELETE', url: '/api/journal/entries/2026-10-09' }).flush(null);
    await settle();
    await answer();
    http
      .expectOne('/api/journal/entries/2026-10-09')
      .flush(null, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(textarea().value).toBe('');
  });

  it('opens today for a day after today, or a day that is not a day', async () => {
    await start('/journal?day=2026-10-30');
    await answer();
    expect(text(root().querySelector('#entry-heading')!)).toBe('Saturday, October 10');

    await TestBed.inject(Router).navigateByUrl('/journal?day=2026-02-30');
    await settle();
    expect(text(root().querySelector('#entry-heading')!)).toBe('Saturday, October 10');
  });

  it('searches through the address', async () => {
    await start();
    await answer();

    const search = root().querySelector<HTMLInputElement>('#journal-search')!;
    search.value = 'marco';
    search.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 350));
    await settle();

    expect(TestBed.inject(Router).url).toBe('/journal?q=marco');
    const list = http.expectOne((r) => r.url === '/api/journal/entries');
    expect(list.request.params.get('q')).toBe('marco');
    list.flush(testJournalPage([]));
    await settle();
    expect(text(root().querySelector('[data-testid="no-entries"]')!)).toBe('No entry matches.');
  });

  it('shows the search of the address after back or forward, and runs it again when typed', async () => {
    await start('/journal?q=marco');
    await answer();
    const search = root().querySelector<HTMLInputElement>('#journal-search')!;
    expect(search.value).toBe('marco');

    await TestBed.inject(Router).navigateByUrl('/journal');
    await settle();
    http.expectOne((r) => r.url === '/api/journal/entries').flush(testJournalPage([]));
    await settle();
    expect(search.value).toBe('');

    search.value = 'marco';
    search.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 350));
    await settle();
    expect(TestBed.inject(Router).url).toBe('/journal?q=marco');
    http.expectOne((r) => r.url === '/api/journal/entries').flush(testJournalPage([]));
    await settle();
  });

  it('lets a read-only user read only', async () => {
    await start('/journal', [provideReadOnlyUser()]);
    await answer(testJournalSummary({ today: testEntry() }));

    expect(textarea().disabled).toBe(true);
    expect(textarea().value).toBe(testEntry().text);
    expect(button('save')).toBeNull();
    expect(root().querySelector('[data-testid="read-only"]')).not.toBeNull();
  });
});
