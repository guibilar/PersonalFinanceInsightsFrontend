import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { TaskNewComponent } from './task-new.component';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { DOC_ID, testDocument } from '../../../testing/test-documents';
import { provideReadOnlyUser } from '../../../testing/test-auth';
import { testTask } from '../../../testing/test-tasks';

describe('TaskNewComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let router: Router;

  const root = () => harness.routeNativeElement as HTMLElement;
  const field = (selector: string) => root().querySelector<HTMLInputElement>(selector)!;
  const submit = () =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent!.trim() === 'Add task',
    )!;

  async function render(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  function configure(extra: unknown[] = []): void {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'tasks/new', component: TaskNewComponent },
          { path: 'tasks', children: [] },
          { path: 'documents/:id', children: [] },
        ]),
        provideLocationMocks(),
        ...(extra as []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  }

  afterEach(() => http.verify());

  it('adds a task with its details, then goes to the list', async () => {
    configure();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/tasks/new', TaskNewComponent);
    const changes = TestBed.inject(DataChangesService).version();

    submit().click();
    await render();
    http.expectNone({ method: 'POST', url: '/api/tasks' });
    expect(root().querySelector('.invalid-feedback')!.textContent).toContain('Give it a title.');

    const title = field('input[formcontrolname="title"]');
    title.value = 'Server backup check';
    title.dispatchEvent(new Event('input'));
    const due = field('input[formcontrolname="dueOn"]');
    due.value = '2026-10-18';
    due.dispatchEvent(new Event('input'));
    field('input[formcontrolname="repeats"]').click();
    await render();
    submit().click();

    const post = http.expectOne({ method: 'POST', url: '/api/tasks' });
    expect(post.request.body).toEqual({
      title: 'Server backup check',
      notes: null,
      dueOn: '2026-10-18',
      tags: [],
      repeat: { every: 1, unit: 'Weeks', mode: 'FromDueDate' },
      sortOrder: null,
      links: [],
    });
    post.flush(testTask({ id: 'n1', title: 'Server backup check' }));
    await render();

    expect(router.url).toBe('/tasks');
    expect(TestBed.inject(DataChangesService).version()).toBe(changes + 1);
    const toast = TestBed.inject(ToastService).toasts()[0];
    expect(toast.message).toBe('Added “Server backup check”');
    expect(toast.link!.route).toBe('/tasks/n1');
  });

  it('starts from a document: the title, the date, and the link, then goes back to it', async () => {
    configure();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      `/tasks/new?documentId=${DOC_ID}&title=Renew%20Car%20insurance&dueOn=2026-10-18`,
      TaskNewComponent,
    );
    TestBed.tick();
    http.expectOne(`/api/documents/${DOC_ID}`).flush(testDocument({ title: 'Car insurance' }));
    await render();

    expect(field('input[formcontrolname="title"]').value).toBe('Renew Car insurance');
    expect(field('input[formcontrolname="dueOn"]').value).toBe('2026-10-18');
    expect(root().querySelector('[data-testid="link-note"]')!.textContent).toContain(
      '“Car insurance”',
    );

    submit().click();
    const post = http.expectOne({ method: 'POST', url: '/api/tasks' });
    expect(post.request.body.links).toEqual([{ kind: 'Documents.Document', targetId: DOC_ID }]);
    post.flush(testTask({ title: 'Renew Car insurance' }));
    await render();

    expect(router.url).toBe(`/documents/${DOC_ID}`);
  });

  it('ignores a document id that is not one, and a day that is not one', async () => {
    configure();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/tasks/new?documentId=nope&dueOn=soon', TaskNewComponent);
    await render();

    expect(root().querySelector('[data-testid="link-note"]')).toBeNull();
    expect(field('input[formcontrolname="dueOn"]').value).toBe('');
  });

  it('says that a read-only user cannot add a task', async () => {
    configure([provideReadOnlyUser()]);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/tasks/new', TaskNewComponent);

    expect(root().querySelector('[data-testid="read-only"]')!.textContent).toContain(
      'This account can only read tasks.',
    );
    expect(root().querySelector('form')).toBeNull();
  });
});
