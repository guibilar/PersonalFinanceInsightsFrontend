import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TransactionRepository } from './transaction-repository';
import { AccountType } from '../models/enums/account-type';

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

  it('uploads a statement as multipart form data', () => {
    const file = new File(['2026-01-03,METRO,4.50,'], 'cibc_credit.csv', { type: 'text/csv' });
    repository.importStatement(file, AccountType.CreditCard).subscribe();

    const req = http.expectOne('/api/Transaction/Import');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect((body.get('file') as File).name).toBe('cibc_credit.csv');
    expect(body.get('account')).toBe('CreditCard');
    req.flush({ read: 1, added: 1, skipped: 0 });
  });

  it('unlinks a transaction by id', () => {
    repository.unlinkTransaction('t1').subscribe();

    const req = http.expectOne('/api/Transaction/UnlinkTransaction/t1');
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });
});
