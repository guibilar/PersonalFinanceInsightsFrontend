import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { InboxPageComponent } from './inbox-page.component';
import { InboxItemDto } from '../../../core/models/outputs/inbox-output-dto';
import { provideReadOnlyUser } from '../../../testing/test-auth';
import { testJournalSummary, testEntry } from '../../../testing/test-journal';
import { journalWithNote, taskFromNote } from '../inbox';

function note(changes: Partial<InboxItemDto> = {}): InboxItemDto {
  return {
    id: 'n1',
    text: 'Call the plumber\nAbout the leak under the sink',
    createdAt: '2026-10-09T18:00:00Z',
    updatedAt: '2026-10-09T18:00:00Z',
    doneAt: null,
    sortedTo: null,
    ...changes,
  };
}

function page(items: InboxItemDto[]) {
  return {
    items,
    page: 1,
    pageSize: 50,
    totalCount: items.length,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  };
}

describe('InboxPageComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = (el: Element) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
  const button = (label: string, scope: ParentNode = root()) =>
    Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent!.trim() === label,
    )!;

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  async function start(url = '/inbox', extra: unknown[] = []): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'inbox', component: InboxPageComponent },
          { path: '**', children: [] },
        ]),
        provideLocationMocks(),
        ...(extra as []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, InboxPageComponent);
    TestBed.tick();
  }

  function answerList(items: InboxItemDto[], done = false): void {
    const request = http.expectOne((r) => r.url === '/api/inbox' && r.method === 'GET');
    expect(request.request.params.get('done')).toBe(String(done));
    request.flush(page(items));
  }

  function type(value: string): void {
    const area = root().querySelector<HTMLTextAreaElement>('#note-text')!;
    area.value = value;
    area.dispatchEvent(new Event('input'));
  }

  afterEach(() => http.verify());

  it('lists the notes to sort, and saves a quick note to the Inbox', async () => {
    await start();
    answerList([note()]);
    await settle();

    expect(text(root().querySelector('[data-testid="count"]')!)).toBe('1 note');
    expect(root().querySelector('[data-note="n1"] .note-text')!.textContent).toContain(
      'About the leak',
    );

    type('  Buy furnace filters ');
    await settle();
    button('Save').click();
    const add = http.expectOne({ method: 'POST', url: '/api/inbox' });
    expect(add.request.body).toEqual({ text: 'Buy furnace filters' });
    add.flush(note({ id: 'n2', text: 'Buy furnace filters' }));
    await settle();
    answerList([note({ id: 'n2', text: 'Buy furnace filters' }), note()]);
    await settle();
    expect(root().querySelector<HTMLTextAreaElement>('#note-text')!.value).toBe('');
  });

  it('sends a quick note straight to a task or to the journal', async () => {
    await start();
    answerList([]);
    await settle();

    type('Call the plumber\nAbout the leak');
    button('Task').click();
    await settle();
    button('Save').click();
    const task = http.expectOne({ method: 'POST', url: '/api/tasks' });
    expect(task.request.body).toEqual({
      title: 'Call the plumber',
      notes: 'About the leak',
      dueOn: null,
      tags: [],
      repeat: null,
    });
    task.flush({});
    await settle();
    answerList([]);
    await settle();

    type('A long walk.');
    button('Journal').click();
    await settle();
    button('Save').click();
    http
      .expectOne('/api/journal/summary')
      .flush(testJournalSummary({ today: testEntry({ text: 'Morning: coffee.' }) }));
    const journal = http.expectOne({ method: 'PUT', url: '/api/journal/entries/2026-10-10' });
    expect(journal.request.body).toEqual({ text: 'Morning: coffee.\n\nA long walk.' });
    journal.flush(testEntry());
    await settle();
    answerList([]);
  });

  it('sorts a note into a task, then marks it done with where it went', async () => {
    await start();
    answerList([note()]);
    await settle();

    button('To task', root().querySelector('[data-note="n1"]')!).click();
    http.expectOne({ method: 'POST', url: '/api/tasks' }).flush({});
    const done = http.expectOne({ method: 'POST', url: '/api/inbox/n1/done' });
    expect(done.request.body).toEqual({ sortedTo: 'Task' });
    done.flush(note({ doneAt: '2026-10-10T16:00:00Z', sortedTo: 'Task' }));
    await settle();
    answerList([]);
    await settle();
    expect(text(root().querySelector('[data-testid="empty"]')!)).toBe(
      'Nothing to sort. A quick note shows here until you sort it.',
    );
  });

  it('shows the sorted notes with an undo', async () => {
    await start('/inbox?view=sorted');
    answerList([note({ doneAt: '2026-10-10T16:00:00Z', sortedTo: 'Journal' })], true);
    await settle();

    expect(root().querySelector('#note-text')).toBeNull();
    expect(text(root().querySelector('[data-note="n1"]')!)).toContain('sorted to Journal');
    button('Undo').click();
    http.expectOne({ method: 'POST', url: '/api/inbox/n1/reopen' }).flush(note());
    await settle();
    answerList([], true);
  });

  it('lets a read-only user read only', async () => {
    await start('/inbox', [provideReadOnlyUser()]);
    answerList([note()]);
    await settle();

    expect(root().querySelector('[data-testid="read-only"]')).not.toBeNull();
    expect(root().querySelector('#note-text')).toBeNull();
    expect(button('To task')).toBeUndefined();
  });

  it('makes a task and a journal text from a note', () => {
    expect(taskFromNote('  Title \n rest  ')).toEqual({ title: 'Title', notes: 'rest' });
    expect(taskFromNote('Only a title')).toEqual({ title: 'Only a title', notes: null });
    expect(taskFromNote('x'.repeat(250)).title.length).toBe(200);
    expect(journalWithNote(null, ' New ')).toBe('New');
    expect(journalWithNote('Old', 'New')).toBe('Old\n\nNew');
  });
});
