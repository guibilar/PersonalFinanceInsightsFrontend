import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { PersonDetailComponent } from './person-detail.component';
import { PEOPLE_TODAY } from '../people';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { PersonDto } from '../../../core/models/outputs/people-output-dto';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { provideReadOnlyUser } from '../../../testing/test-auth';
import { LOAN_ID, PERSON_ID, testLoan, testPerson } from '../../../testing/test-people';

describe('PersonDetailComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = (el: Element) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
  const rows = (testId: string) =>
    Array.from(root().querySelectorAll(`[data-testid="${testId}"] > li`)).map(text);
  const button = (label: string) =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => text(b) === label,
    )!;
  const messages = () =>
    TestBed.inject(ToastService)
      .toasts()
      .map((t) => t.message);

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  async function open(person: PersonDto = testPerson()): Promise<void> {
    await harness.navigateByUrl(`/people/${PERSON_ID}`, PersonDetailComponent);
    TestBed.tick();
    http.expectOne(`/api/people/${PERSON_ID}`).flush(person);
    await settle();
  }

  /** The page loads the person again after each change. */
  async function reload(person: PersonDto = testPerson()): Promise<void> {
    await settle();
    http.expectOne(`/api/people/${PERSON_ID}`).flush(person);
    await settle();
  }

  async function start(extra: unknown[] = []): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'people', children: [] },
          { path: 'people/:id', component: PersonDetailComponent },
        ]),
        provideLocationMocks(),
        { provide: PEOPLE_TODAY, useValue: () => '2026-10-14' },
        ...(extra as []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  }

  afterEach(() => http.verify());

  describe('for a user who can write', () => {
    beforeEach(() => start());

    it('shows the strip, the gift ideas, the open loan, and the history', async () => {
      await open();

      expect(text(root().querySelector('[data-testid="name"]')!)).toBe('Marco Silva');
      expect(text(root().querySelector('[data-testid="groups"]')!)).toBe('Friend · Gaming group');
      expect(text(root().querySelector('[data-testid="strip"]')!)).toBe(
        'Birthday Nov 2, 1990 Last contact Aug 28, 2026 Reminder Every 6 weeks',
      );
      expect(rows('gifts')).toEqual([
        'Pour-over coffee kettle Birthday · $49.50',
        'Hiking day pack',
        'Board game · given Dec 25, 2025 · $64.00',
      ]);
      expect(rows('open-loans')).toEqual([
        'Camping stove Lent Jul 4, 2026 · due Aug 1, 2026 Not returned Got it back',
      ]);
      expect(rows('history')).toEqual([
        'Aug 28, 2026 · Coffee Talked about his new job.',
        'Jul 4, 2026 · Lent Camping stove Not returned',
      ]);
    });

    it('lists its links and the documents and tasks that link to the person', async () => {
      await open(
        testPerson({
          links: [{ id: 'l1', kind: 'Home.Item', targetId: 'item-1', createdAt: '' }],
          linkedFrom: [
            { kind: 'Documents.Document', targetId: 'doc-1', title: 'Birthday card scan' },
            { kind: 'Tasks.Task', targetId: 'task-1', title: 'Call Marco' },
          ],
        }),
      );

      expect(rows('links')).toEqual([
        'Home item Unlink',
        'Birthday card scan Document links here',
        'Call Marco Task links here',
      ]);
      const from = Array.from(root().querySelectorAll('[data-testid="linked-from"] a'));
      expect(from.map((a) => a.getAttribute('href'))).toEqual([
        '/documents/doc-1',
        '/tasks/task-1',
      ]);
    });

    it('links a task picked in the task picker', async () => {
      await open();

      button('Task').click();
      await settle();
      const tasks = http.expectOne((r) => r.url === '/api/tasks');
      expect(tasks.request.params.get('status')).toBe('Open');
      tasks.flush({
        items: [
          {
            id: 'task-1',
            title: 'Call Marco',
            notes: null,
            dueOn: '2026-10-16',
            tags: [],
            status: 'Open',
            doneAt: null,
            repeat: null,
            links: [],
            createdAt: '',
            updatedAt: '',
          },
        ],
        page: 1,
        pageSize: 10,
        totalCount: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      });
      await settle();
      document.querySelector<HTMLButtonElement>('[aria-label="Link Call Marco"]')!.click();

      const post = http.expectOne({ method: 'POST', url: `/api/people/${PERSON_ID}/links` });
      expect(post.request.body).toEqual({ kind: 'Tasks.Task', targetId: 'task-1' });
      post.flush({ id: 'l1', kind: 'Tasks.Task', targetId: 'task-1', createdAt: '' });
      await reload();
      expect(messages()).toEqual(['Linked to “Call Marco”']);
      expect(document.querySelector('app-task-picker')).toBeNull();
    });

    it('logs a contact for today', async () => {
      await open();
      const changes = TestBed.inject(DataChangesService).version();

      button('Log contact').click();
      await settle();
      const form = root().querySelector<HTMLFormElement>('[data-testid="contact-form"]')!;
      const note = form.querySelector<HTMLTextAreaElement>('#contact-note')!;
      note.value = 'Quick call';
      note.dispatchEvent(new Event('input'));
      form.requestSubmit();

      const request = http.expectOne({
        method: 'POST',
        url: `/api/people/${PERSON_ID}/interactions`,
      });
      expect(request.request.body).toEqual({ occurredOn: null, kind: 'Call', note: 'Quick call' });
      request.flush({});
      await reload();
      expect(TestBed.inject(DataChangesService).version()).toBe(changes + 1);
      expect(messages()).toContain('Logged the contact');
      expect(root().querySelector('[data-testid="contact-form"]')).toBeNull();
    });

    it('adds a gift idea, and marks one as given today', async () => {
      await open();

      button('Gift idea').click();
      await settle();
      const form = root().querySelector<HTMLFormElement>('[data-testid="gift-form"]')!;
      const title = form.querySelector<HTMLInputElement>('#gift-title')!;
      title.value = 'Book';
      title.dispatchEvent(new Event('input'));
      form.requestSubmit();
      const add = http.expectOne({ method: 'POST', url: `/api/people/${PERSON_ID}/gifts` });
      expect(add.request.body).toEqual({
        title: 'Book',
        notes: null,
        price: null,
        occasion: null,
        givenOn: null,
      });
      add.flush({});
      await reload();

      root().querySelector<HTMLInputElement>('#gift-g1')!.click();
      const given = http.expectOne({ method: 'PUT', url: '/api/people/gifts/g1' });
      expect(given.request.body).toEqual({
        title: 'Pour-over coffee kettle',
        notes: null,
        price: 49.5,
        occasion: 'Birthday',
        givenOn: '2026-10-14',
      });
      given.flush({});
      await reload();
      expect(messages()).toContain('Marked “Pour-over coffee kettle” as given');
    });

    it('lends an item, and marks a loan as back', async () => {
      await open();

      button('Lend item').click();
      await settle();
      const form = root().querySelector<HTMLFormElement>('[data-testid="loan-form"]')!;
      const item = form.querySelector<HTMLInputElement>('#loan-item')!;
      item.value = 'Drill';
      item.dispatchEvent(new Event('input'));
      form.requestSubmit();
      const add = http.expectOne({ method: 'POST', url: `/api/people/${PERSON_ID}/loans` });
      expect(add.request.body).toEqual({
        itemName: 'Drill',
        direction: 'Lent',
        lentOn: null,
        dueOn: null,
        returnedOn: null,
        notes: null,
      });
      add.flush(testLoan({ itemName: 'Drill' }));
      await reload();

      button('Got it back').click();
      const back = http.expectOne({ method: 'PUT', url: `/api/people/loans/${LOAN_ID}` });
      expect(back.request.body).toEqual({
        itemName: 'Camping stove',
        direction: 'Lent',
        lentOn: '2026-07-04',
        dueOn: '2026-08-01',
        returnedOn: '2026-10-14',
        notes: null,
      });
      back.flush({});
      await reload();
      expect(messages()).toContain('“Camping stove” is back');
    });

    it('deletes the person after a confirmation, and goes back to People', async () => {
      await open();

      button('Delete').click();
      await settle();
      const confirm = Array.from(
        document.querySelectorAll<HTMLButtonElement>('app-confirm-dialog button'),
      ).find((b) => b.textContent!.trim() === 'Delete')!;
      confirm.click();
      http.expectOne({ method: 'DELETE', url: `/api/people/${PERSON_ID}` }).flush(null);
      await settle();
      expect(TestBed.inject(Router).url).toBe('/people');
    });
  });

  it('shows no actions to a read-only user', async () => {
    await start([provideReadOnlyUser()]);
    await open();

    expect(root().querySelector('[data-testid="actions"]')).toBeNull();
    expect(button('Edit')).toBeUndefined();
    expect(button('Got it back')).toBeUndefined();
    expect(root().querySelector<HTMLInputElement>('#gift-g1')!.disabled).toBe(true);
  });

  it('says when the person does not exist', async () => {
    await start();
    await harness.navigateByUrl(`/people/${PERSON_ID}`, PersonDetailComponent);
    TestBed.tick();
    http
      .expectOne(`/api/people/${PERSON_ID}`)
      .flush({ title: 'Not found' }, { status: 404, statusText: 'Not Found' });
    await settle();

    expect(root().textContent).toContain('This person does not exist any more');
  });
});
