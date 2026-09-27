import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BudgetRepository } from './budget-repository';
import { Status } from '../models/enums/status';

describe('BudgetRepository', () => {
  let repository: BudgetRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    repository = TestBed.inject(BudgetRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the filter to /api/Budget/Filter', () => {
    const filter = { status: Status.Active, page: 2, pageSize: 25 };
    repository.filter(filter).subscribe();

    const req = http.expectOne('/api/Budget/Filter');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(filter);
    req.flush({ items: [], page: 2, pageSize: 25, totalCount: 0, totalPages: 0 });
  });

  it('updates and deletes by id', () => {
    const budget = { id: 'b1', name: 'Food', description: 'd', amount: 10, status: Status.Active };
    repository.update('b1', budget).subscribe();
    repository.delete('b1').subscribe();

    const update = http.expectOne({ method: 'PUT', url: '/api/Budget/b1' });
    expect(update.request.body).toEqual(budget);
    update.flush(null);

    const remove = http.expectOne({ method: 'DELETE', url: '/api/Budget/b1' });
    remove.flush(null);
  });
});
