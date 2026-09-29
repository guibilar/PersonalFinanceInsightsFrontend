import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TransactionType } from '../models/enums/transaction-type';
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

  it('uploads a statement as multipart form data', () => {
    const file = new File(['2026-01-03,METRO,4.50,'], 'cibc_credit.csv', { type: 'text/csv' });
    repository.importStatement(file, 'a1').subscribe();

    const req = http.expectOne('/api/Transaction/Import');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect((body.get('file') as File).name).toBe('cibc_credit.csv');
    expect(body.get('accountId')).toBe('a1');
    expect(body.has('confirmed')).toBe(false);
    req.flush({ read: 1, added: 1, skipped: 0 });
  });

  it('confirms an import the API thought was for another account', () => {
    const file = new File(['x'], 'cibc.csv', { type: 'text/csv' });
    repository.importStatement(file, 'a1', true).subscribe();

    const body = http.expectOne('/api/Transaction/Import').request.body as FormData;
    expect(body.get('confirmed')).toBe('true');
  });

  it('adds a transaction by hand', () => {
    const input = {
      date: '2026-09-10',
      description: 'COFFEE',
      amount: 4.5,
      transactionType: TransactionType.Debit,
      accountId: 'a1',
    };
    repository.add(input).subscribe();

    const req = http.expectOne({ method: 'POST', url: '/api/Transaction' });
    expect(req.request.body).toEqual(input);
    req.flush(null);
  });

  it('re-applies the category and flow rules', () => {
    repository.applyRules().subscribe();

    http
      .expectOne({ method: 'POST', url: '/api/Transaction/ApplyRules' })
      .flush({ checked: 1, updated: 0 });
  });

  it('unlinks a transaction by id', () => {
    repository.unlinkTransaction('t1').subscribe();

    const req = http.expectOne('/api/Transaction/UnlinkTransaction/t1');
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });
});
