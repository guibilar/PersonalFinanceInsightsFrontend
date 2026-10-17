import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { TaskListComponent } from './task-list.component';
import { TaskCountsService } from '../../../core/data/task-counts.service';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { TaskSummaryDto } from '../../../core/models/outputs/task-output-dto';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { provideReadOnlyUser } from '../../../testing/test-auth';
import {
  TASK_ID,
  TODAY,
  testTask,
  testTaskPage,
  testTaskSummary,
} from '../../../testing/test-tasks';

const REPEAT = { every: 4, unit: 'Days' as const, mode: 'FromCompletion' as const };

/** One task in each section: overdue, today, a repeated one today, upcoming, later, and without a date. */
function openTasks(): TaskSummaryDto[] {
  return [
    testTaskSummary({ id: 'late', title: 'Call the landlord', dueOn: '2026-10-10' }),
    testTaskSummary({ id: TASK_ID, title: 'Buy printer paper', tags: ['office'] }),
    testTaskSummary({ id: 'plants', title: 'Water the plants', repeat: REPEAT, tags: ['home'] }),
    testTaskSummary({
      id: 'soon',
      title: 'Compare car insurance',
      dueOn: '2026-10-16',
      links: [{ id: 'l1', kind: 'Documents.Document', targetId: 'd1', createdAt: '' }],
    }),
    testTaskSummary({ id: 'later', title: 'Clean the gutters', dueOn: '2026-11-03' }),
    testTaskSummary({ id: 'some-day', title: 'Learn the guitar', dueOn: null }),
  ];
}

describe('TaskListComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let router: Router;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = (el: Element) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
  const rows = (testId: string) =>
    Array.from(root().querySelectorAll(`[data-testid="${testId}"] > li`)).map(text);
  /** The section titles as written (the page shows them in capitals). */
  const headings = () =>
    Array.from(root().querySelectorAll('h2.section-label')).map((h) =>
      h.textContent!.replace(/\s+/g, ' ').trim(),
    );
  const messages = () =>
    TestBed.inject(ToastService)
      .toasts()
      .map((t) => t.message);
  const isList = (status: string) => (r: HttpRequest<unknown>) =>
    r.url === '/api/tasks' && r.params.get('status') === status;

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  /** Answers the list of open tasks, and gives the request. */
  async function answerOpen(items: TaskSummaryDto[] = openTasks(), totalCount = items.length) {
    TestBed.tick();
    const request = http.expectOne(isList('Open'));
    request.flush(testTaskPage(items, totalCount));
    await settle();
    return request;
  }

  async function open(url = '/tasks', items: TaskSummaryDto[] = openTasks()) {
    await harness.navigateByUrl(url, TaskListComponent);
    return answerOpen(items);
  }

  function configure(extra: unknown[] = []): void {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'tasks', component: TaskListComponent },
          { path: 'tasks/:id', children: [] },
        ]),
        provideLocationMocks(),
        {
          provide: TaskCountsService,
          useValue: { today: signal(TODAY), overdue: signal(1) },
        },
        ...(extra as []),
      ],
    });
  }

  async function start(extra: unknown[] = []): Promise<void> {
    configure(extra);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  }

  afterEach(() => http.verify());

  describe('for a user who can write', () => {
    beforeEach(() => start());

    it('shows the open tasks in sections, the repeated ones also under Recurring', async () => {
      const request = await open();

      expect(request.request.params.get('pageSize')).toBe('100');
      expect(request.request.params.has('due')).toBe(false);
      expect(headings()).toEqual([
        'Overdue · 1',
        'Today · 2',
        'Upcoming · 1',
        'Later and no date · 2',
        'Recurring',
      ]);
      expect(rows('overdue')).toEqual(['Call the landlord Oct 10 · 4 days late']);
      expect(rows('today')).toEqual([
        'Buy printer paper Today #office',
        'Water the plants Today · Every 4 days, after each done #home',
      ]);
      expect(rows('upcoming')).toEqual(['Compare car insurance Fri, Oct 16 Documents']);
      expect(rows('later')).toEqual(['Clean the gutters Nov 3, 2026', 'Learn the guitar']);
      expect(rows('recurring')).toEqual([
        'Water the plants Every 4 days, after each done · Next: Today #home',
      ]);
      expect(root().querySelector('[data-testid="overdue"] a')!.getAttribute('href')).toBe(
        '/tasks/late',
      );
      // Done stays closed, and loads nothing.
      expect(root().querySelector<HTMLDetailsElement>('[data-testid="done-section"]')!.open).toBe(
        false,
      );
    });

    it('says when nothing is due today', async () => {
      await open('/tasks', []);

      expect(headings()).toEqual(['Today · 0']);
      expect(text(root().querySelector('[data-testid="today-empty"]')!)).toBe(
        'Nothing is due today.',
      );
    });

    it('adds a task from the quick add, due today, then loads the list again', async () => {
      await open();
      const changes = TestBed.inject(DataChangesService).version();
      const input = root().querySelector<HTMLInputElement>('#quick-add-title')!;
      input.value = '  Pay the dentist ';
      input.dispatchEvent(new Event('input'));
      // Enter in the field submits the form.
      root().querySelector<HTMLFormElement>('[data-testid="quick-add"]')!.requestSubmit();

      const create = http.expectOne({ method: 'POST', url: '/api/tasks' });
      expect(create.request.body).toEqual({
        title: 'Pay the dentist',
        notes: null,
        dueOn: TODAY,
        tags: [],
        repeat: null,
      });
      create.flush(testTask({ id: 'new', title: 'Pay the dentist' }));
      await settle();

      expect(TestBed.inject(DataChangesService).version()).toBe(changes + 1);
      expect(messages()).toEqual(['Added “Pay the dentist”']);
      expect(input.value).toBe('');
      await answerOpen();
    });

    it('adds a task for another day from the small menu', async () => {
      await open();
      const input = root().querySelector<HTMLInputElement>('#quick-add-title')!;
      const due = root().querySelector<HTMLSelectElement>('#quick-add-due')!;
      const add = async (title: string, choice: string, day?: string) => {
        input.value = title;
        input.dispatchEvent(new Event('input'));
        due.value = choice;
        due.dispatchEvent(new Event('change'));
        await settle();
        if (day) {
          const picker = root().querySelector<HTMLInputElement>('#quick-add-day')!;
          picker.value = day;
          picker.dispatchEvent(new Event('input'));
        }
        root().querySelector<HTMLFormElement>('[data-testid="quick-add"]')!.requestSubmit();
        const create = http.expectOne({ method: 'POST', url: '/api/tasks' });
        create.flush(testTask({ title }));
        await settle();
        await answerOpen();
        return create.request.body.dueOn;
      };

      expect(await add('Tomorrow task', 'tomorrow')).toBe('2026-10-15');
      expect(await add('Next week task', 'next-week')).toBe('2026-10-21');
      expect(await add('Some day task', 'none')).toBeNull();
      expect(await add('Picked task', 'pick', '2026-12-24')).toBe('2026-12-24');
      // After each add, the menu is back on Today.
      expect(due.value).toBe('today');
    });

    it('marks a task done with its checkbox, and undoes it from the toast', async () => {
      await open();
      const checkbox = root().querySelector<HTMLInputElement>(
        '[data-testid="today"] input[type="checkbox"]',
      )!;
      expect(checkbox.getAttribute('aria-label')).toBe('Mark done: Buy printer paper');

      checkbox.click();
      http
        .expectOne({ method: 'POST', url: `/api/tasks/${TASK_ID}/done` })
        .flush(testTask({ status: 'Done', doneAt: '2026-10-14T15:00:00Z' }));
      await settle();
      await answerOpen(openTasks().filter((t) => t.id !== TASK_ID));

      const toast = TestBed.inject(ToastService).toasts()[0];
      expect(toast.message).toBe('Done: “Buy printer paper”.');
      expect(rows('today')).toEqual([
        'Water the plants Today · Every 4 days, after each done #home',
      ]);

      toast.action!.run();
      http.expectOne({ method: 'POST', url: `/api/tasks/${TASK_ID}/undo` }).flush(testTask());
      await settle();
      await answerOpen();
      expect(messages()).toContain('“Buy printer paper” is open again.');
      expect(rows('today').length).toBe(2);
    });

    it('clears the tick when the task could not be marked done', async () => {
      await open();
      const checkbox = root().querySelector<HTMLInputElement>(
        '[data-testid="today"] input[type="checkbox"]',
      )!;

      checkbox.click();
      http
        .expectOne({ method: 'POST', url: `/api/tasks/${TASK_ID}/done` })
        .flush(null, { status: 500, statusText: 'Server Error' });
      await settle();

      expect(messages()).toEqual(['Could not mark the task done.']);
      expect(checkbox.checked).toBe(false);
      expect(checkbox.disabled).toBe(false);
    });

    it('tells the next date of a repeated task that is done', async () => {
      await open();
      root()
        .querySelectorAll<HTMLInputElement>('[data-testid="today"] input[type="checkbox"]')[1]
        .click();
      http.expectOne({ method: 'POST', url: '/api/tasks/plants/done' }).flush(
        testTask({
          id: 'plants',
          title: 'Water the plants',
          repeat: REPEAT,
          dueOn: '2026-10-18',
        }),
      );
      await settle();
      await answerOpen();

      expect(messages()).toEqual(['Done: “Water the plants”. Next: Oct 18, 2026.']);
    });

    it('shows only the overdue tasks for ?due=overdue, with a link to all', async () => {
      const request = await open('/tasks?due=overdue', [openTasks()[0]]);

      expect(request.request.params.get('due')).toBe('overdue');
      expect(text(root().querySelector('[data-testid="due-filter"]')!)).toBe(
        'Only the overdue tasks. Show all',
      );
      expect(headings()).toEqual(['Overdue · 1']);
      expect(root().querySelector('[data-testid="done-section"]')).toBeNull();
      expect(root().querySelector('[data-testid="due-filter"] a')!.getAttribute('href')).toBe(
        '/tasks',
      );
    });

    it('says so when no task is overdue any more', async () => {
      await open('/tasks?due=overdue', []);

      expect(text(root().querySelector('[data-testid="no-match"]')!)).toBe('No overdue tasks.');
    });

    it('filters by a tag from a row, and searches, in the address', async () => {
      await open();

      root()
        .querySelector<HTMLButtonElement>('button[aria-label="Show the tasks with the tag home"]')!
        .click();
      await settle();
      expect(router.url).toBe('/tasks?tag=home');
      const tagged = await answerOpen([openTasks()[2]]);
      expect(tagged.request.params.get('tag')).toBe('home');
      expect(root().querySelector<HTMLSelectElement>('#task-tag')!.value).toBe('home');

      const search = root().querySelector<HTMLInputElement>('#task-search')!;
      search.value = 'water';
      search.dispatchEvent(new Event('input'));
      await new Promise((resolve) => setTimeout(resolve, 350));
      await settle();
      expect(router.url).toBe('/tasks?tag=home&q=water');
      const searched = await answerOpen([openTasks()[2]]);
      expect(searched.request.params.get('q')).toBe('water');

      const tag = root().querySelector<HTMLSelectElement>('#task-tag')!;
      tag.value = '';
      tag.dispatchEvent(new Event('change'));
      await settle();
      expect(router.url).toBe('/tasks?q=water');
      await answerOpen([]);
      expect(text(root().querySelector('[data-testid="no-match"]')!)).toBe(
        'No open task matches “water”.',
      );
    });

    it('loads the last done tasks when "Done" opens, newest first, and reopens one', async () => {
      await open();
      const details = root().querySelector<HTMLDetailsElement>('[data-testid="done-section"]')!;
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
      await settle();

      const request = http.expectOne(isList('Done'));
      request.flush(
        testTaskPage([
          testTaskSummary({
            id: 'a',
            title: 'Old',
            status: 'Done',
            doneAt: '2026-10-01T10:00:00Z',
          }),
          testTaskSummary({
            id: 'b',
            title: 'New',
            status: 'Done',
            doneAt: '2026-10-13T10:00:00Z',
          }),
        ]),
      );
      await settle();

      expect(rows('done')).toEqual(['New Done Oct 13, 2026', 'Old Done Oct 1, 2026']);
      const checkbox = root().querySelector<HTMLInputElement>('[data-testid="done"] input')!;
      expect(checkbox.checked).toBe(true);
      expect(checkbox.getAttribute('aria-label')).toBe('Mark not done: New');

      checkbox.click();
      http.expectOne({ method: 'POST', url: '/api/tasks/b/undo' }).flush(testTask({ id: 'b' }));
      await settle();
      await answerOpen();
      http.expectOne(isList('Done')).flush(testTaskPage([]));
      await settle();
    });

    it('shows an error with a retry', async () => {
      await harness.navigateByUrl('/tasks', TaskListComponent);
      TestBed.tick();
      http.expectOne(isList('Open')).flush(null, { status: 500, statusText: 'Server Error' });
      await settle();
      expect(root().textContent).toContain('Could not load the tasks.');

      Array.from(root().querySelectorAll('button'))
        .find((b) => b.textContent!.includes('Retry'))!
        .click();
      await answerOpen();
      expect(rows('today').length).toBe(2);
    });
  });

  describe('for a read-only user', () => {
    beforeEach(() => start([provideReadOnlyUser()]));

    it('has no quick add, and the checkboxes are off', async () => {
      await open();

      expect(root().querySelector('[data-testid="quick-add"]')).toBeNull();
      expect(root().querySelector('a[href="/tasks/new"]')).toBeNull();
      const boxes = Array.from(root().querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
      expect(boxes.length).toBeGreaterThan(0);
      expect(boxes.every((box) => box.disabled)).toBe(true);
    });
  });
});
