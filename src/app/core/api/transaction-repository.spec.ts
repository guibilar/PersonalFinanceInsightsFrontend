import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TransactionRepository } from './transaction-repository';

describe('TransactionRepository', () => {
  let repository: TransactionRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    repository = TestBed.inject(TransactionRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('links a transaction to a budget', () => {
    repository.linkTransaction({ transactionId: 't1', budgetId: 'b1' }).subscribe();

    const req = http.expectOne('/api/Transaction/LinkTransaction');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ transactionId: 't1', budgetId: 'b1' });
    req.flush(null);
  });

  it('unlinks a transaction by id', () => {
    repository.unlinkTransaction('t1').subscribe();

    const req = http.expectOne('/api/Transaction/UnlinkTransaction/t1');
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });
});
