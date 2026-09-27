import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TransactionListComponent } from './transaction-list.component';
import { Category } from '../../../core/models/enums/category';
import { AccountType } from '../../../core/models/enums/account-type';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { ToastService } from '../../../shared/ui/toast/toast.service';

describe('TransactionListComponent', () => {
  let fixture: ComponentFixture<TransactionListComponent>;
  let component: TransactionListComponent;
  let http: HttpTestingController;

  const emptyPage = {
    items: [],
    page: 1,
    pageSize: 25,
    totalCount: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TransactionListComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    fixture = TestBed.createComponent(TransactionListComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    TestBed.tick();
    // The link dropdown's budgets are not part of these tests.
    http.match('/api/Budget/Filter').forEach((r) => r.flush(emptyPage));
  });

  afterEach(() => http.verify());

  function lastFilterRequest() {
    TestBed.tick();
    const requests = http.match('/api/Transaction/Filter');
    // A new filter cancels the previous request, as the app should; answer only the live ones.
    requests.filter((r) => !r.cancelled).forEach((r) => r.flush(emptyPage));
    return requests.at(-1)!.request.body;
  }

  it('loads newest first by default', () => {
    expect(lastFilterRequest()).toEqual(
      jasmine.objectContaining({ sortBy: 'Date', sortDirection: 'Descending', page: 1 }),
    );
  });

  it('flips direction on the same column and uses the natural direction for a new one', () => {
    component.sort('Date');
    expect(lastFilterRequest()).toEqual(
      jasmine.objectContaining({ sortBy: 'Date', sortDirection: 'Ascending' }),
    );

    component.sort('Description');
    expect(lastFilterRequest()).toEqual(
      jasmine.objectContaining({ sortBy: 'Description', sortDirection: 'Ascending' }),
    );

    component.sort('Amount');
    expect(lastFilterRequest()).toEqual(
      jasmine.objectContaining({ sortBy: 'Amount', sortDirection: 'Descending' }),
    );
    expect(component.ariaSort('Amount')).toBe('descending');
    expect(component.ariaSort('Date')).toBe('none');
  });

  it('keeps sort and page size when filters change, and goes back to page 1', () => {
    component.sort('Amount');
    component.onPageSizeChange(50);
    component.onPageChange(3);
    component.onCriteriaChange({ category: Category.Dining });

    expect(lastFilterRequest()).toEqual({
      category: Category.Dining,
      sortBy: 'Amount',
      sortDirection: 'Descending',
      pageSize: 50,
      page: 1,
    });
    expect(component.hasCriteria()).toBeTrue();
  });

  describe('editing and category rules', () => {
    const coffee: TransactionOutputDto = {
      id: 't1',
      date: '2026-09-10',
      amount: 4,
      description: 'COFFEE',
      category: Category.Other,
      categoryLocked: false,
      account: AccountType.CreditCard,
      budgetId: '',
    };

    // reload() is ignored while the first load is still settling, so let it finish first.
    beforeEach(async () => {
      lastFilterRequest();
      await fixture.whenStable();
    });

    it('saves an edit, closes the panel and reloads', () => {
      component.editingTransaction.set(coffee);

      component.onEditSubmit({ description: 'Coffee', category: Category.Dining });
      const put = http.expectOne({ method: 'PUT', url: '/api/Transaction/t1' });
      expect(put.request.body).toEqual({ description: 'Coffee', category: Category.Dining });
      expect(component.savingEdit()).toBeTrue();
      put.flush({
        ...coffee,
        description: 'Coffee',
        category: Category.Dining,
        categoryLocked: true,
      });

      expect(component.editingTransaction()).toBeNull();
      expect(component.savingEdit()).toBeFalse();
      lastFilterRequest();
      expect(
        TestBed.inject(ToastService)
          .toasts()
          .map((t) => t.message),
      ).toEqual(['Transaction updated']);
    });

    it('keeps the panel open when saving fails', () => {
      component.editingTransaction.set(coffee);

      component.onEditSubmit({ description: 'Coffee', category: Category.Dining });
      http
        .expectOne({ method: 'PUT', url: '/api/Transaction/t1' })
        .flush(null, { status: 500, statusText: 'Error' });

      expect(component.editingTransaction()).toEqual(coffee);
      expect(component.savingEdit()).toBeFalse();
    });

    it('applies the category rules after confirming and reports what changed', () => {
      component.confirmingRules.set(true);

      component.applyCategoryRules();
      expect(component.confirmingRules()).toBeFalse();
      expect(component.applyingRules()).toBeTrue();
      http
        .expectOne({ method: 'POST', url: '/api/Transaction/ApplyCategoryRules' })
        .flush({ checked: 40, updated: 3 });

      expect(component.applyingRules()).toBeFalse();
      lastFilterRequest();
      expect(
        TestBed.inject(ToastService)
          .toasts()
          .map((t) => t.message),
      ).toEqual(['Recategorised 3 of 40 transactions']);
    });
  });
});
