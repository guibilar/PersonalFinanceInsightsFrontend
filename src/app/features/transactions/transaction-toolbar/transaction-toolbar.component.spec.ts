import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  SEARCH_DEBOUNCE_MS,
  TransactionCriteria,
  TransactionToolbarComponent,
} from './transaction-toolbar.component';
import { Category } from '../../../core/models/enums/category';
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
    // No zone.js in this app, so fake timers come from Jasmine; debounceTime also reads the clock.
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 8, 27));
    try {
      create();

      component.form.controls.description.setValue('cof');
      component.form.controls.description.setValue(' coffee ');
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS - 1);
      expect(emitted).toEqual([]);

      jasmine.clock().tick(1);
      expect(emitted).toEqual([
        { description: 'coffee', category: undefined, startDate: undefined, endDate: undefined },
      ]);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('searches again for the same words after the search chip was removed', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 8, 27));
    try {
      create();
      const search = component.form.controls.description;
      search.setValue('coffee');
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS);
      fixture.componentRef.setInput('filter', { page: 1, pageSize: 10, description: 'coffee' });
      fixture.detectChanges();

      component.remove('description');
      fixture.componentRef.setInput('filter', { page: 1, pageSize: 10 });
      fixture.detectChanges();
      search.setValue('coffee');
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS);

      expect(emitted.map((c) => c.description)).toEqual(['coffee', undefined, 'coffee']);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('does not search again when the text ends up unchanged', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 8, 27));
    try {
      create({ page: 1, pageSize: 10, description: 'coffee' });

      component.form.controls.description.setValue('coffe');
      component.form.controls.description.setValue('coffee ');
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS);

      expect(emitted).toEqual([]);
    } finally {
      jasmine.clock().uninstall();
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
      startDate: '2026-01-01',
      endDate: '',
    });
    expect(emitted).toEqual([]);
  });

  it('clears everything', () => {
    create({ page: 1, pageSize: 10, description: 'rent' });

    component.clearAll();

    expect(emitted).toEqual([{}]);
  });
});
