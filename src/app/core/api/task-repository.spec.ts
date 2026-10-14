import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TaskRepository } from './task-repository';
import { TASK_ID, testCounts, testTask, testTaskPage } from '../../testing/test-tasks';

describe('TaskRepository', () => {
  let repository: TaskRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    repository = TestBed.inject(TaskRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists with only the filters that have a value', () => {
    repository
      .list({ status: 'Open', tag: '', due: 'overdue', q: null, page: 1, pageSize: 100 })
      .subscribe();

    const request = http.expectOne((r) => r.url === '/api/tasks');
    expect(request.request.params.keys()).toEqual(['status', 'due', 'page', 'pageSize']);
    expect(request.request.params.get('due')).toBe('overdue');
    request.flush(testTaskPage([]));
  });

  it('reads the summary and the tasks of a document', () => {
    repository.summary().subscribe((counts) => expect(counts.overdue).toBe(2));
    http.expectOne('/api/tasks/summary').flush(testCounts({ overdue: 2 }));

    repository.listByLink('Documents.Document', 'd1').subscribe();
    const request = http.expectOne((r) => r.url === '/api/tasks/by-link');
    expect(request.request.params.get('kind')).toBe('Documents.Document');
    expect(request.request.params.get('id')).toBe('d1');
    request.flush([]);
  });

  it('adds, changes and deletes a task', () => {
    const details = {
      title: 'Water the plants',
      notes: null,
      dueOn: null,
      tags: ['home'],
      repeat: { every: 4, unit: 'Days' as const, mode: 'FromCompletion' as const },
    };
    repository
      .create({ ...details, links: [{ kind: 'Documents.Document', targetId: 'd1' }] })
      .subscribe();
    const create = http.expectOne({ method: 'POST', url: '/api/tasks' });
    expect(create.request.body.links).toEqual([{ kind: 'Documents.Document', targetId: 'd1' }]);
    create.flush(testTask());

    repository.update(TASK_ID, details).subscribe();
    const update = http.expectOne({ method: 'PUT', url: `/api/tasks/${TASK_ID}` });
    expect(update.request.body.repeat).toEqual(details.repeat);
    update.flush(testTask());

    repository.delete(TASK_ID).subscribe();
    http.expectOne({ method: 'DELETE', url: `/api/tasks/${TASK_ID}` }).flush(null);
  });

  it('marks done, undoes, links and unlinks', () => {
    repository.done(TASK_ID).subscribe();
    http.expectOne({ method: 'POST', url: `/api/tasks/${TASK_ID}/done` }).flush(testTask());
    repository.undo(TASK_ID).subscribe();
    http.expectOne({ method: 'POST', url: `/api/tasks/${TASK_ID}/undo` }).flush(testTask());

    repository.addLink(TASK_ID, { kind: 'Money.Transaction', targetId: 't1' }).subscribe();
    const link = http.expectOne({ method: 'POST', url: `/api/tasks/${TASK_ID}/links` });
    expect(link.request.body).toEqual({ kind: 'Money.Transaction', targetId: 't1' });
    link.flush({ id: 'l1', kind: 'Money.Transaction', targetId: 't1', createdAt: '' });

    repository.removeLink(TASK_ID, 'l1').subscribe();
    http.expectOne({ method: 'DELETE', url: `/api/tasks/${TASK_ID}/links/l1` }).flush(null);
  });
});
