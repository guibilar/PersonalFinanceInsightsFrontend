import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BulkChange, TransactionBulkBar } from './transaction-bulk-bar';
import { TEST_CATEGORIES } from '../../../testing/test-categories';

describe('TransactionBulkBar', () => {
  let fixture: ComponentFixture<TransactionBulkBar>;
  let changes: BulkChange[];

  beforeEach(async () => {
    fixture = TestBed.createComponent(TransactionBulkBar);
    fixture.componentRef.setInput('count', 2);
    fixture.componentRef.setInput('categories', [TEST_CATEGORIES.dining]);
    fixture.componentRef.setInput('tags', [
      { id: 'g-trip', name: 'Vacation 2026', transactionCount: 1 },
    ]);
    changes = [];
    fixture.componentInstance.apply.subscribe((change) => changes.push(change));
    await fixture.whenStable();
  });

  function pick(id: string, value: string): HTMLSelectElement {
    const select = fixture.nativeElement.querySelector(`#${id}`) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    return select;
  }

  it('says how many are ticked', () => {
    expect(fixture.nativeElement.textContent).toContain('2 selected');
  });

  it('turns each pick into one change, and goes back to its prompt', () => {
    const category = pick('bulk-category', TEST_CATEGORIES.dining.id);
    pick('bulk-budget', 'unlink');
    pick('bulk-tag', 'remove:g-trip');
    pick('bulk-tag', 'add:g-trip');

    expect(changes).toEqual([
      { categoryId: TEST_CATEGORIES.dining.id },
      { unlinkBudget: true },
      { removeTagId: 'g-trip' },
      { addTagId: 'g-trip' },
    ]);
    expect(category.value).toBe('');
  });

  it('is cleared from its button', () => {
    let cleared = false;
    fixture.componentInstance.cleared.subscribe(() => (cleared = true));
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(cleared).toBe(true);
  });
});
