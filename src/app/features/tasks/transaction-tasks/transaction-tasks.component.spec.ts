import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TransactionTasksComponent } from './transaction-tasks.component';
import { TaskSummaryDto } from '../../../core/models/outputs/task-output-dto';
import { provideReadOnlyUser } from '../../../testing/test-auth';
import { TX_ID, testTransaction } from '../../../testing/test-documents';
import { testTask } from '../../../testing/test-tasks';

@Component({
  imports: [TransactionTasksComponent],
  template: `<app-transaction-tasks [transaction]="transaction" />`,
})
class HostComponent {
  readonly transaction = testTransaction({ description: 'PLUMBER JOE' });
}

describe('TransactionTasksComponent', () => {
  let http: HttpTestingController;

  function configure(extra: unknown[] = []): void {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        ...(extra as []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  }

  async function create(tasks: TaskSummaryDto[]) {
    const fixture = TestBed.createComponent(HostComponent);
    TestBed.tick();
    const request = http.expectOne((r) => r.url === '/api/tasks/by-link');
    expect(request.request.params.get('kind')).toBe('Money.Transaction');
    expect(request.request.params.get('id')).toBe(TX_ID);
    request.flush(tasks);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => http.verify());

  it('lists the tasks of the transaction, and adds one linked to it', async () => {
    configure();
    const task = testTask({ title: 'Ask for the warranty', dueOn: '2026-10-20' });
    const root = await create([task]);

    const row = root.querySelector<HTMLAnchorElement>('[data-testid="transaction-tasks"] a')!;
    expect(row.getAttribute('href')).toBe(`/tasks/${task.id}`);
    expect(row.textContent).toContain('Ask for the warranty');
    expect(row.textContent).toContain('Due Oct 20, 2026');

    const add = root.querySelector<HTMLAnchorElement>('[data-testid="add-task"]')!;
    const url = new URL(add.href);
    expect(url.pathname).toBe('/tasks/new');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      transactionId: TX_ID,
      transaction: 'PLUMBER JOE',
    });
  });

  it('shows no add action to a read-only user', async () => {
    configure([provideReadOnlyUser()]);
    const root = await create([]);

    expect(root.querySelector('[data-testid="add-task"]')).toBeNull();
    expect(root.textContent).toContain('No tasks.');
  });
});
