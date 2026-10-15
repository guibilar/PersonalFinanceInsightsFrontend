import { Component, input, output, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { TaskDetailComponent } from './task-detail.component';
import { TaskCountsService } from '../../../core/data/task-counts.service';
import { TaskDto, TaskLinkDto } from '../../../core/models/outputs/task-output-dto';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import {
  DOC_ID,
  TX_ID,
  testDocument,
  testPage,
  testSummary,
  testTransaction,
} from '../../../testing/test-documents';
import { signInAsReadOnly } from '../../../testing/test-auth';
import { TASK_ID, TODAY, testTask } from '../../../testing/test-tasks';
import { LinkedItemsComponent } from '../../home/linked-items/linked-items.component';
import { LinkedPeopleComponent } from '../../people/linked-people/linked-people.component';

/** The Home items section has its own tests (LinkedItemsComponent); here it only shows what it got. */
@Component({
  selector: 'app-linked-items',
  template: '<span data-testid="linked-items-stub">{{ kind() }} {{ ownerId() }}</span>',
})
class LinkedItemsStub {
  readonly kind = input.required<string>();
  readonly ownerId = input.required<string>();
  readonly ownerLinks = input<unknown[]>([]);
  readonly changed = output<void>();
}

/** The People section has its own tests (LinkedPeopleComponent); here it only shows what it got. */
@Component({
  selector: 'app-linked-people',
  template: '<span data-testid="linked-people-stub">{{ kind() }} {{ ownerId() }}</span>',
})
class LinkedPeopleStub {
  readonly kind = input.required<string>();
  readonly ownerId = input.required<string>();
  readonly ownerLinks = input<unknown[]>([]);
  readonly changed = output<void>();
}

const DOC_LINK: TaskLinkDto = {
  id: 'link-doc',
  kind: 'Documents.Document',
  targetId: DOC_ID,
  createdAt: '',
};
const TX_LINK: TaskLinkDto = {
  id: 'link-tx',
  kind: 'Money.Transaction',
  targetId: TX_ID,
  createdAt: '',
};

describe('TaskDetailComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let router: Router;

  const root = () => harness.routeNativeElement as HTMLElement;
  const taskUrl = `/api/tasks/${TASK_ID}`;
  const text = (selector: string) =>
    (root().querySelector(selector) as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
  const messages = () =>
    TestBed.inject(ToastService)
      .toasts()
      .map((t) => t.message);
  const button = (label: string) =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent!.trim() === label,
    );
  const confirmButton = (label: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')).find(
      (b) => b.textContent!.trim() === label,
    )!;

  async function render(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  async function answer(task: TaskDto = testTask()): Promise<void> {
    TestBed.tick();
    http.expectOne({ method: 'GET', url: taskUrl }).flush(task);
    await render();
  }

  async function open(task: TaskDto = testTask()): Promise<void> {
    await harness.navigateByUrl(`/tasks/${TASK_ID}`, TaskDetailComponent);
    await answer(task);
  }

  /** The finance lookups of the linked transactions. */
  function lookups(): TestRequest[] {
    TestBed.tick();
    return http.match((r) => r.url === '/api/Transaction/Filter' && !!r.body?.transactionId);
  }

  beforeEach(async () => {
    TestBed.overrideComponent(TaskDetailComponent, {
      remove: { imports: [LinkedItemsComponent, LinkedPeopleComponent] },
      add: { imports: [LinkedItemsStub, LinkedPeopleStub] },
    });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'tasks/:id', component: TaskDetailComponent },
          { path: 'tasks', children: [] },
          { path: 'documents/:id', children: [] },
          { path: 'money/transactions', children: [] },
        ]),
        provideLocationMocks(),
        { provide: TaskCountsService, useValue: { today: signal(TODAY), overdue: signal(0) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  it('shows Home item and person links in their own sections, not with the other links', async () => {
    await open(
      testTask({
        links: [
          { id: 'l-home', kind: 'Home.Item', targetId: 'item-1', createdAt: '' },
          { id: 'l-person', kind: 'People.Person', targetId: 'person-1', createdAt: '' },
        ],
      }),
    );

    expect(lookups()).toEqual([]);
    expect(root().querySelector('[data-testid="links"]')).toBeNull();
    expect(text('[data-testid="linked-items-stub"]')).toBe(`Tasks.Task ${TASK_ID}`);
    expect(text('[data-testid="linked-people-stub"]')).toBe(`Tasks.Task ${TASK_ID}`);
  });

  it('shows the details, the repeat, and the last times it was done', async () => {
    await open(
      testTask({
        title: 'Water the plants',
        dueOn: '2026-10-12',
        tags: ['home'],
        notes: 'The fern needs less.',
        repeat: { every: 4, unit: 'Days', mode: 'FromCompletion' },
        completions: [
          { id: 'c2', doneAt: '2026-10-08T15:00:00Z', dueOn: '2026-10-07' },
          { id: 'c1', doneAt: '2026-10-03T15:00:00Z', dueOn: null },
        ],
      }),
    );

    expect(root().querySelector('h1')!.textContent).toContain('Water the plants');
    expect(text('[data-testid="status"]')).toBe('Overdue');
    expect(text('[data-testid="details"]')).toBe(
      'Due Oct 12, 2026 (Oct 12 · 2 days late) Repeat Every 4 days, after each done Tags #home Notes The fern needs less.',
    );
    expect(text('[data-testid="completions"]')).toBe('Oct 8, 2026 (due Oct 7, 2026) Oct 3, 2026');
    expect(root().querySelector('[data-testid="details"] a')!.getAttribute('href')).toBe(
      '/tasks?tag=home',
    );
  });

  it('marks the task done, and offers "Undo"', async () => {
    await open();

    button('Mark done')!.click();
    http
      .expectOne({ method: 'POST', url: `${taskUrl}/done` })
      .flush(testTask({ status: 'Done', doneAt: '2026-10-14T15:00:00Z' }));
    const done = testTask({
      status: 'Done',
      doneAt: '2026-10-14T15:00:00Z',
      completions: [{ id: 'c1', doneAt: '2026-10-14T15:00:00Z', dueOn: TODAY }],
    });
    await answer(done);

    expect(text('[data-testid="status"]')).toBe('Done');
    expect(button('Mark done')).toBeUndefined();
    const toast = TestBed.inject(ToastService).toasts()[0];
    expect(toast.message).toBe('Done: “Buy printer paper”.');
    expect(toast.action!.label).toBe('Undo');

    button('Undo the last done')!.click();
    http.expectOne({ method: 'POST', url: `${taskUrl}/undo` }).flush(testTask());
    await answer(testTask());
    expect(text('[data-testid="status"]')).toBe('Open');
  });

  it('edits the details, with a repeat, and saves them all', async () => {
    await open(testTask({ sortOrder: 3 }));
    button('Edit')!.click();
    await render();

    const field = (selector: string) => root().querySelector<HTMLInputElement>(selector)!;
    const title = field('input[formcontrolname="title"]');
    title.value = 'Smoke detector batteries';
    title.dispatchEvent(new Event('input'));
    const tags = field('input[formcontrolname="tags"]');
    tags.value = 'Home, safety';
    tags.dispatchEvent(new Event('input'));
    field('input[formcontrolname="repeats"]').click();
    await render();

    // The repeat explains both ways to find the next date.
    expect(text('[data-testid="repeat"]')).toContain('After each done');
    expect(text('[data-testid="repeat"]')).toContain('On a fixed schedule');
    const every = field('input[formcontrolname="every"]');
    every.value = '12';
    every.dispatchEvent(new Event('input'));
    const unit = root().querySelector<HTMLSelectElement>('select[formcontrolname="unit"]')!;
    unit.value = 'Months';
    unit.dispatchEvent(new Event('change'));
    field('input[id$="-FromCompletion"]').click();
    await render();
    button('Save')!.click();

    const put = http.expectOne({ method: 'PUT', url: taskUrl });
    expect(put.request.body).toEqual({
      title: 'Smoke detector batteries',
      notes: null,
      dueOn: TODAY,
      tags: ['home', 'safety'],
      repeat: { every: 12, unit: 'Months', mode: 'FromCompletion' },
      sortOrder: 3,
    });
    put.flush(testTask({ title: 'Smoke detector batteries' }));
    await answer(
      testTask({
        title: 'Smoke detector batteries',
        repeat: { every: 12, unit: 'Months', mode: 'FromCompletion' },
      }),
    );

    expect(messages()).toEqual(['Saved “Smoke detector batteries”']);
    expect(text('[data-testid="details"]')).toContain('Every 12 months, after each done');
  });

  it('does not save a repeat of 0 units', async () => {
    await open(testTask({ repeat: { every: 1, unit: 'Weeks', mode: 'FromDueDate' } }));
    button('Edit')!.click();
    await render();
    const every = root().querySelector<HTMLInputElement>('input[formcontrolname="every"]')!;
    every.value = '0';
    every.dispatchEvent(new Event('input'));
    await render();
    button('Save')!.click();
    await render();

    http.expectNone({ method: 'PUT', url: taskUrl });
    expect(text('[data-testid="repeat"]')).toContain('Repeat every 1 to 1000 weeks.');
  });

  it('shows the linked document and transaction, each opening its page', async () => {
    await open(testTask({ links: [DOC_LINK, TX_LINK] }));
    TestBed.tick();
    http.expectOne(`/api/documents/${DOC_ID}`).flush(testDocument());
    lookups()[0].flush(testPage([testTransaction()]));
    await render();

    const rows = Array.from(root().querySelectorAll<HTMLElement>('[data-testid="links"] li'));
    expect(rows.map((row) => row.innerText.replace(/\s+/g, ' ').trim())).toEqual([
      'Dishwasher warranty Warranty · expires Nov 9, 2026',
      'COSTCO WHOLESALE Oct 3, 2026 · Visa -$142.18',
    ]);
    const links = rows.map((row) => row.querySelector('a')!.getAttribute('href'));
    expect(links).toEqual([`/documents/${DOC_ID}`, `/money/transactions?id=${TX_ID}`]);
  });

  it('says so when a linked document is gone', async () => {
    await open(testTask({ links: [DOC_LINK] }));
    TestBed.tick();
    http
      .expectOne(`/api/documents/${DOC_ID}`)
      .flush(null, { status: 404, statusText: 'Not Found' });
    await render();

    expect(text('[data-testid="links"]')).toBe('A document that does not exist any more');
  });

  it('links to a document picked in the picker', async () => {
    await open();
    button('Link to a document')!.click();
    await render();
    TestBed.tick();
    const recent = http.expectOne((r) => r.url === '/api/documents');
    expect(recent.request.params.get('pageSize')).toBe('10');
    recent.flush(testPage([testSummary()]));
    await render();

    document
      .querySelector<HTMLButtonElement>(
        '[data-testid="picker-documents"] button[aria-label="Link Dishwasher warranty"]',
      )!
      .click();
    const post = http.expectOne({ method: 'POST', url: `${taskUrl}/links` });
    expect(post.request.body).toEqual({ kind: 'Documents.Document', targetId: DOC_ID });
    post.flush(DOC_LINK, { status: 201, statusText: 'Created' });
    await answer(testTask({ links: [DOC_LINK] }));
    http.expectOne(`/api/documents/${DOC_ID}`).flush(testDocument());
    await render();

    expect(document.querySelector('app-document-picker')).toBeNull();
    expect(messages()).toEqual(['Linked to “Dishwasher warranty”']);
    expect(text('[data-testid="links"]')).toContain('Dishwasher warranty');
  });

  it('links to a transaction picked in the picker (the one of Documents)', async () => {
    await open();
    button('Link to a transaction')!.click();
    await render();
    TestBed.tick();
    http
      .expectOne((r) => r.url === '/api/Transaction/Filter' && !r.body?.transactionId)
      .flush(testPage([testTransaction()]));
    await render();

    document
      .querySelector<HTMLButtonElement>(
        '[data-testid="picker-transactions"] button[aria-label^="Link COSTCO WHOLESALE"]',
      )!
      .click();
    const post = http.expectOne({ method: 'POST', url: `${taskUrl}/links` });
    expect(post.request.body).toEqual({ kind: 'Money.Transaction', targetId: TX_ID });
    post.flush(TX_LINK, { status: 201, statusText: 'Created' });
    await answer(testTask({ links: [TX_LINK] }));
    lookups()[0].flush(testPage([testTransaction()]));
    await render();

    expect(messages()).toEqual(['Linked to “COSTCO WHOLESALE”']);
  });

  it('says why a link failed', async () => {
    await open();
    button('Link to a transaction')!.click();
    await render();
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/Transaction/Filter').flush(testPage([testTransaction()]));
    await render();
    document
      .querySelector<HTMLButtonElement>('[data-testid="picker-transactions"] button')!
      .click();
    http
      .expectOne({ method: 'POST', url: `${taskUrl}/links` })
      .flush(null, { status: 502, statusText: 'Bad Gateway' });
    await render();

    expect(messages()).toEqual(['The server could not check with Money. Try again later.']);
    expect(document.querySelector('app-transaction-picker')).not.toBeNull();
  });

  it('unlinks after a confirmation', async () => {
    await open(testTask({ links: [DOC_LINK] }));
    TestBed.tick();
    http.expectOne(`/api/documents/${DOC_ID}`).flush(testDocument());
    await render();

    root()
      .querySelector<HTMLButtonElement>('button[aria-label="Unlink “Dishwasher warranty”"]')!
      .click();
    await render();
    confirmButton('Unlink').click();

    http.expectOne({ method: 'DELETE', url: `${taskUrl}/links/link-doc` }).flush(null);
    await answer(testTask());
    expect(messages()).toEqual(['Unlinked']);
    expect(root().querySelector('[data-testid="links"]')).toBeNull();
  });

  it('deletes after a confirmation, then goes back to the list', async () => {
    await open();

    button('Delete')!.click();
    await render();
    confirmButton('Delete').click();

    http.expectOne({ method: 'DELETE', url: taskUrl }).flush(null);
    await render();
    expect(router.url).toBe('/tasks');
    expect(messages()).toEqual(['Deleted “Buy printer paper”']);
  });

  it('says so when the task does not exist', async () => {
    await harness.navigateByUrl(`/tasks/${TASK_ID}`, TaskDetailComponent);
    TestBed.tick();
    http.expectOne(taskUrl).flush(null, { status: 404, statusText: 'Not Found' });
    await render();

    expect(root().textContent).toContain('This task does not exist any more.');
  });

  it('shows no change actions to a read-only user', async () => {
    await signInAsReadOnly(http);
    await open(
      testTask({
        links: [DOC_LINK],
        completions: [{ id: 'c1', doneAt: '2026-10-08T15:00:00Z', dueOn: null }],
      }),
    );
    TestBed.tick();
    http.expectOne(`/api/documents/${DOC_ID}`).flush(testDocument());
    await render();

    expect(root().querySelector('[data-testid="links"] a')).not.toBeNull();
    for (const label of [
      'Mark done',
      'Undo the last done',
      'Delete',
      'Edit',
      'Link to a document',
      'Link to a transaction',
    ]) {
      expect(button(label)).toBeUndefined();
    }
    expect(root().querySelector('button[title="Unlink"]')).toBeNull();
  });
});
