import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DocumentTasksComponent } from './document-tasks.component';
import { TaskCountsService } from '../../../core/data/task-counts.service';
import { DocumentSummaryDto } from '../../../core/models/outputs/document-output-dto';
import { DOC_ID, testSummary } from '../../../testing/test-documents';
import { provideReadOnlyUser } from '../../../testing/test-auth';
import { TASK_ID, TODAY, testTask, testTaskSummary } from '../../../testing/test-tasks';

@Component({
  imports: [DocumentTasksComponent],
  template: '<app-document-tasks [document]="document()" />',
})
class HostComponent {
  readonly document = signal<DocumentSummaryDto>(testSummary());
}

describe('DocumentTasksComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<HostComponent>;

  const root = () => fixture.nativeElement as HTMLElement;
  const byLink = `/api/tasks/by-link?kind=Documents.Document&id=${DOC_ID}`;

  async function render(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    fixture.detectChanges();
  }

  function create(document: DocumentSummaryDto, extra: unknown[] = []): void {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: TaskCountsService, useValue: { today: signal(TODAY), overdue: signal(0) } },
        ...(extra as []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.document.set(document);
    TestBed.tick();
  }

  afterEach(() => http.verify());

  it('lists the tasks of the document, each opening its page', async () => {
    create(testSummary({ expiresOn: null }));
    http
      .expectOne(byLink)
      .flush([testTaskSummary({ title: 'File the warranty', dueOn: '2026-10-20' })]);
    await render();

    const rows = Array.from(
      root().querySelectorAll<HTMLElement>('[data-testid="document-tasks"] li'),
    );
    expect(rows.map((row) => row.innerText.replace(/\s+/g, ' ').trim())).toEqual([
      'File the warranty Tue, Oct 20',
    ]);
    expect(rows[0].querySelector('a')!.getAttribute('href')).toBe(`/tasks/${TASK_ID}`);
    // Without an expiry, "Add task" only links the document.
    expect(root().querySelector('[data-testid="add-task"]')!.getAttribute('href')).toBe(
      `/tasks/new?documentId=${DOC_ID}`,
    );
  });

  it('offers a renewal task 14 days before the expiry', async () => {
    create(testSummary({ title: 'Car insurance', expiresOn: '2026-11-30' }));
    http.expectOne(byLink).flush([]);
    await render();

    expect(root().querySelector('[data-testid="no-tasks"]')!.textContent).toContain(
      'Add a task to renew it before it expires.',
    );
    const href = root().querySelector('[data-testid="add-task"]')!.getAttribute('href')!;
    const params = new URLSearchParams(href.split('?')[1]);
    expect(href.startsWith('/tasks/new?')).toBe(true);
    expect(params.get('documentId')).toBe(DOC_ID);
    expect(params.get('title')).toBe('Renew Car insurance');
    expect(params.get('dueOn')).toBe('2026-11-16');
  });

  it('marks a task done from the document, then loads the list again', async () => {
    create(testSummary());
    http.expectOne(byLink).flush([testTaskSummary()]);
    await render();

    root().querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    http
      .expectOne({ method: 'POST', url: `/api/tasks/${TASK_ID}/done` })
      .flush(testTask({ status: 'Done' }));
    await render();
    http.expectOne(byLink).flush([testTaskSummary({ status: 'Done' })]);
    await render();

    expect(root().querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
  });

  it('has no "Add task" for a read-only user', async () => {
    create(testSummary(), [provideReadOnlyUser()]);
    http.expectOne(byLink).flush([testTaskSummary()]);
    await render();

    expect(root().querySelector('[data-testid="add-task"]')).toBeNull();
    expect(root().querySelector<HTMLInputElement>('input[type="checkbox"]')!.disabled).toBe(true);
  });
});
