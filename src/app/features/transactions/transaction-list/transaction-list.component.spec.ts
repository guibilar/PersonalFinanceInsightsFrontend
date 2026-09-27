import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TransactionListComponent } from './transaction-list.component';
import { Category } from '../../../core/models/enums/category';

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
});
