import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  SEARCH_DEBOUNCE_MS,
  TransactionCriteria,
  TransactionToolbarComponent,
} from './transaction-toolbar.component';
import { Category } from '../../../core/models/enums/category';
import { Flow } from '../../../core/models/enums/flow';
import { AccountType } from '../../../core/models/enums/account-type';
import { TransactionFilterInputDto } from '../../../core/models/inputs/transaction-filter-input-dto';

describe('TransactionToolbarComponent', () => {
  let fixture: ComponentFixture<TransactionToolbarComponent>;
  let component: TransactionToolbarComponent;
  let emitted: TransactionCriteria[];

  function create(filter: TransactionFilterInputDto = { page: 1, pageSize: 10 }): void {
    TestBed.configureTestingModule({
      imports: [TransactionToolbarComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(TransactionToolbarComponent);
    fixture.componentRef.setInput('filter', filter);
    component = fixture.componentInstance;
    emitted = [];
    component.criteriaChange.subscribe((criteria) => emitted.push(criteria));
    fixture.detectChanges();
  }

  it('debounces search and emits trimmed text once', () => {
    // No zone.js in this app, so fake timers come from Vitest; debounceTime also reads the clock.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 27));
    try {
      create();

      component.form.controls.description.setValue('cof');
      component.form.controls.description.setValue(' coffee ');
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
      expect(emitted).toEqual([]);

      vi.advanceTimersByTime(1);
      expect(emitted).toEqual([
        { description: 'coffee', category: undefined, startDate: undefined, endDate: undefined },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('searches again for the same words after the search chip was removed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 27));
    try {
      create();
      const search = component.form.controls.description;
      search.setValue('coffee');
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      fixture.componentRef.setInput('filter', { page: 1, pageSize: 10, description: 'coffee' });
      fixture.detectChanges();

      component.remove('description');
      fixture.componentRef.setInput('filter', { page: 1, pageSize: 10 });
      fixture.detectChanges();
      search.setValue('coffee');
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);

      expect(emitted.map((c) => c.description)).toEqual(['coffee', undefined, 'coffee']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not search again when the text ends up unchanged', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 27));
    try {
      create({ page: 1, pageSize: 10, description: 'coffee' });

      component.form.controls.description.setValue('coffe');
      component.form.controls.description.setValue('coffee ');
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);

      expect(emitted).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies category and dates immediately', () => {
    create();

    component.form.controls.category.setValue(Category.Dining);
    component.form.controls.startDate.setValue('2026-09-01');

    expect(emitted.at(-1)).toEqual({
      description: undefined,
      category: Category.Dining,
      startDate: '2026-09-01',
      endDate: undefined,
    });
  });

  it('shows a chip per active filter and removes one', () => {
    create({
      page: 1,
      pageSize: 10,
      description: 'rent',
      category: Category.Rent,
      endDate: '2026-09-30',
    });

    expect(component.chips().map((chip) => chip.key)).toEqual([
      'description',
      'category',
      'endDate',
    ]);

    component.remove('category');
    expect(emitted.at(-1)).toEqual({
      description: 'rent',
      category: undefined,
      startDate: undefined,
      endDate: '2026-09-30',
    });
  });

  it('fills the fields from the applied filter without emitting', () => {
    create({ page: 1, pageSize: 10, description: 'rent', startDate: '2026-01-01' });

    expect(component.form.getRawValue()).toEqual({
      description: 'rent',
      category: null,
      accountId: null,
      flow: null,
      startDate: '2026-01-01',
      endDate: '',
    });
    expect(emitted).toEqual([]);
  });

  it('filters by account and flow, with the account name on its chip', () => {
    create({ page: 1, pageSize: 10, accountId: 'a2', flow: Flow.Income });
    fixture.componentRef.setInput('accounts', [
      { id: 'a1', name: 'Chequing', type: AccountType.Chequing, transactionCount: 3 },
      { id: 'a2', name: 'Visa', type: AccountType.CreditCard, transactionCount: 2 },
    ]);
    fixture.detectChanges();

    expect(component.chips()).toEqual([
      { key: 'accountId', label: 'Visa' },
      { key: 'flow', label: 'Income' },
    ]);
    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('#tx-account option'),
    ).map((o) => o.textContent?.trim());
    expect(options).toEqual(['All accounts', 'Chequing', 'Visa']);

    component.form.controls.accountId.setValue('a1');
    expect(emitted.at(-1)).toEqual({ accountId: 'a1', flow: Flow.Income });

    component.remove('flow');
    expect(emitted.at(-1)).toEqual({ accountId: 'a1', flow: undefined });
  });

  it('clears everything', () => {
    create({ page: 1, pageSize: 10, description: 'rent' });

    component.clearAll();

    expect(emitted).toEqual([{}]);
  });
});
