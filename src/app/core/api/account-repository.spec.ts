import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AccountRepository } from './account-repository';
import { AccountType } from '../models/enums/account-type';

describe('AccountRepository', () => {
  let repository: AccountRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    repository = TestBed.inject(AccountRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists, creates, renames and deletes accounts', () => {
    repository.getAll().subscribe();
    repository.create({ name: 'Visa', type: AccountType.CreditCard }).subscribe();
    repository.rename('a1', 'Visa Infinite').subscribe();
    repository.delete('a1').subscribe();

    http.expectOne({ method: 'GET', url: '/api/Accounts' }).flush([]);
    expect(http.expectOne({ method: 'POST', url: '/api/Accounts' }).request.body).toEqual({
      name: 'Visa',
      type: AccountType.CreditCard,
    });
    expect(http.expectOne({ method: 'PUT', url: '/api/Accounts/a1' }).request.body).toEqual({
      name: 'Visa Infinite',
    });
    http.expectOne({ method: 'DELETE', url: '/api/Accounts/a1' }).flush(null);
  });
});
