import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  BUDGET_SEARCH_DEBOUNCE_MS,
  BudgetCriteria,
  BudgetToolbarComponent,
} from './budget-toolbar.component';
import { Status } from '../../core/models/enums/status';

describe('BudgetToolbarComponent', () => {
  let fixture: ComponentFixture<BudgetToolbarComponent>;
  let component: BudgetToolbarComponent;
  let emitted: BudgetCriteria[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BudgetToolbarComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(BudgetToolbarComponent);
    fixture.componentRef.setInput('criteria', { status: Status.Active });
    component = fixture.componentInstance;
    emitted = [];
    component.criteriaChange.subscribe((c) => emitted.push(c));
    fixture.detectChanges();
  });

  it('debounces the name search and keeps the status', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 27));
    try {
      component.search.setValue(' foo');
      component.search.setValue(' food ');
      vi.advanceTimersByTime(BUDGET_SEARCH_DEBOUNCE_MS);

      expect(emitted).toEqual([{ status: Status.Active, name: 'food' }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('searches again for the same name after the filters were cleared', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 27));
    try {
      component.search.setValue('food');
      vi.advanceTimersByTime(BUDGET_SEARCH_DEBOUNCE_MS);
      fixture.componentRef.setInput('criteria', { status: Status.Active, name: 'food' });
      fixture.detectChanges();
      fixture.componentRef.setInput('criteria', {}); // "Clear filters"
      fixture.detectChanges();

      component.search.setValue('food');
      vi.advanceTimersByTime(BUDGET_SEARCH_DEBOUNCE_MS);

      expect(emitted.map((c) => c.name)).toEqual(['food', 'food']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('switches status and marks the pressed button', async () => {
    await fixture.whenStable();
    const pressed = () =>
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('[aria-pressed=true]'),
      ).map((b) => b.textContent?.trim());
    expect(pressed()).toEqual(['Active']);

    component.setStatus(undefined);

    expect(emitted).toEqual([{ status: undefined }]);
  });
});
