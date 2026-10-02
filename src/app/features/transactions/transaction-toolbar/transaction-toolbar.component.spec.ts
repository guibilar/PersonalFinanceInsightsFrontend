import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  SEARCH_DEBOUNCE_MS,
  TransactionCriteria,
  TransactionToolbarComponent,
} from './transaction-toolbar.component';
import { TEST_CATEGORIES, TEST_CATEGORY_LIST } from '../../../testing/test-categories';
import { Flow } from '../../../core/models/enums/flow';
import { AccountType } from '../../../core/models/enums/account-type';
import { StatementFormat } from '../../../core/models/enums/statement-format';
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
    fixture.componentRef.setInput('categories', TEST_CATEGORY_LIST);
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
        { description: 'coffee', categoryId: undefined, startDate: undefined, endDate: undefined },
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

    component.form.controls.categoryId.setValue(TEST_CATEGORIES.dining.id);
    component.form.controls.startDate.setValue('2026-09-01');

    expect(emitted.at(-1)).toEqual({
      description: undefined,
      categoryId: TEST_CATEGORIES.dining.id,
      startDate: '2026-09-01',
      endDate: undefined,
    });
  });

  it('shows a chip per active filter and removes one', () => {
    create({
      page: 1,
      pageSize: 10,
      description: 'rent',
      categoryId: TEST_CATEGORIES.rent.id,
      endDate: '2026-09-30',
    });

    expect(component.chips().map((chip) => chip.key)).toEqual([
      'description',
      'categoryId',
      'endDate',
    ]);
    // The category by its name.
    expect(component.chips()[1].label).toBe('Rent');

    component.remove('categoryId');
    expect(emitted.at(-1)).toEqual({
      description: 'rent',
      categoryId: undefined,
      startDate: undefined,
      endDate: '2026-09-30',
    });
  });

  it('fills the fields from the applied filter without emitting', () => {
    create({ page: 1, pageSize: 10, description: 'rent', startDate: '2026-01-05' });

    expect(component.form.getRawValue()).toEqual({
      description: 'rent',
      categoryId: null,
      accountId: null,
      flow: null,
      period: 'custom',
      startDate: '2026-01-05',
      endDate: '',
    });
    expect(emitted).toEqual([]);
  });

  it('filters by account and flow, with the account name on its chip', () => {
    create({ page: 1, pageSize: 10, accountId: 'a2', flow: Flow.Income });
    fixture.componentRef.setInput('accounts', [
      {
        id: 'a1',
        name: 'Chequing',
        type: AccountType.Chequing,
        format: StatementFormat.Cibc,
        transactionCount: 3,
      },
      {
        id: 'a2',
        name: 'Visa',
        type: AccountType.CreditCard,
        format: StatementFormat.Cibc,
        transactionCount: 2,
      },
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

  describe('dates', () => {
    const root = () => fixture.nativeElement as HTMLElement;

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 8, 15, 12));
    });
    afterEach(() => vi.useRealTimers());

    it('offers presets, and the date fields only for a custom range', () => {
      create();

      const options = Array.from(root().querySelectorAll('#tx-period option')).map((o) =>
        o.textContent!.trim(),
      );
      expect(options).toEqual([
        'All dates',
        'This month',
        'Last month',
        'Last 3 months',
        'Last 6 months',
        'Last 12 months',
        'This year',
        'Last year',
        'Custom range…',
      ]);
      expect(root().querySelector('#tx-from')).toBeNull();
    });

    it("applies a preset's dates at once", () => {
      create({ page: 1, pageSize: 10, description: 'rent' });

      component.form.controls.period.setValue('last3Months');
      expect(emitted.at(-1)).toEqual(
        expect.objectContaining({
          description: 'rent',
          startDate: '2026-06-01',
          endDate: '2026-08-31',
        }),
      );

      component.form.controls.period.setValue('all');
      expect(emitted.at(-1)).toEqual(
        expect.objectContaining({ startDate: undefined, endDate: undefined }),
      );
    });

    it('recognises a preset in the applied dates, and names it on one chip', () => {
      create({ page: 1, pageSize: 10, startDate: '2026-08-01', endDate: '2026-08-31' });

      expect(component.form.controls.period.value).toBe('lastMonth');
      expect(component.chips()).toEqual([
        { key: 'dates', label: 'Last month · Aug 1 – Aug 31, 2026' },
      ]);

      component.remove('dates');
      expect(emitted.at(-1)).toEqual(
        expect.objectContaining({ startDate: undefined, endDate: undefined }),
      );
    });

    it('opens the fields for other dates, and on "Custom range" keeps the dates there are', () => {
      create({ page: 1, pageSize: 10, startDate: '2026-08-10' });
      expect(component.form.controls.period.value).toBe('custom');
      expect(root().querySelector('#tx-from')).not.toBeNull();
      expect(component.chips()).toEqual([{ key: 'startDate', label: 'From 2026-08-10' }]);

      component.form.controls.period.setValue('thisYear');
      fixture.detectChanges();
      expect(root().querySelector('#tx-from')).toBeNull();

      const before = emitted.length;
      component.form.controls.period.setValue('custom');
      fixture.detectChanges();
      expect(emitted.length).toBe(before);
      expect(root().querySelector('#tx-from')).not.toBeNull();
    });
  });

  it('holds back a range that ends before it starts, and says so', () => {
    create({ page: 1, pageSize: 10, startDate: '2026-09-01' });
    const root = fixture.nativeElement as HTMLElement;

    component.form.controls.endDate.setValue('2026-08-15');
    fixture.detectChanges();

    expect(emitted).toEqual([]);
    expect(component.rangeBackwards()).toBe(true);
    expect(root.querySelector('[role=alert]')!.textContent).toContain('ends before it starts');
    expect(root.querySelector('#tx-to')!.classList).toContain('is-invalid');

    component.form.controls.endDate.setValue('2026-09-15');
    fixture.detectChanges();

    expect(emitted.at(-1)).toEqual(
      expect.objectContaining({ startDate: '2026-09-01', endDate: '2026-09-15' }),
    );
    expect(root.querySelector('[role=alert]')).toBeNull();
  });

  it('clears everything', () => {
    create({ page: 1, pageSize: 10, description: 'rent' });

    component.clearAll();

    expect(emitted).toEqual([{}]);
  });
});
