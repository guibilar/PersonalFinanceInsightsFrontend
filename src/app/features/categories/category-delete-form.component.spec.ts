import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryDeleteFormComponent } from './category-delete-form.component';
import { CategoryOutputDto } from '../../core/models/outputs/category-output-dto';
import { TEST_CATEGORIES, TEST_CATEGORY_LIST } from '../../testing/test-categories';

describe('CategoryDeleteFormComponent', () => {
  let fixture: ComponentFixture<CategoryDeleteFormComponent>;
  let component: CategoryDeleteFormComponent;
  let confirmed: string[];

  const root = () => fixture.nativeElement as HTMLElement;

  function create(category: CategoryOutputDto) {
    TestBed.configureTestingModule({
      imports: [CategoryDeleteFormComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(CategoryDeleteFormComponent);
    fixture.componentRef.setInput('category', category);
    fixture.componentRef.setInput('categories', TEST_CATEGORY_LIST);
    component = fixture.componentInstance;
    confirmed = [];
    component.confirmDelete.subscribe((value) => confirmed.push(value));
    fixture.detectChanges();
  }

  it('moves what used it to Other unless another category is picked', () => {
    create({ ...TEST_CATEGORIES.pet, transactionCount: 12, ruleCount: 1 });

    const options = Array.from(root().querySelectorAll('#category-move-to option')).map((o) =>
      o.textContent!.trim(),
    );
    expect(root().textContent).toContain('Its 12 transactions and 1 rule move to');
    // Every other category, but not itself.
    expect(options).toEqual(TEST_CATEGORY_LIST.filter((c) => c.name !== 'Pet').map((c) => c.name));
    expect(component.form.controls.moveTo.value).toBe(TEST_CATEGORIES.other.id);

    component.form.controls.moveTo.setValue(TEST_CATEGORIES.dining.id);
    component.onSubmit();

    expect(confirmed).toEqual([TEST_CATEGORIES.dining.id]);
  });

  it('says "moves" for a single transaction or rule', () => {
    create({ ...TEST_CATEGORIES.pet, transactionCount: 0, ruleCount: 1 });

    expect(root().querySelector('label[for=category-move-to]')!.textContent!.trim()).toBe(
      'Its 1 rule moves to',
    );
  });

  it('asks nothing more when nothing uses it', () => {
    create(TEST_CATEGORIES.shopping);

    expect(root().querySelector('#category-move-to')).toBeNull();
    expect(root().textContent).toContain('No transactions or rules use it.');
    component.onSubmit();
    expect(confirmed).toEqual([TEST_CATEGORIES.other.id]);
  });

  it('does not delete twice while deleting', () => {
    create(TEST_CATEGORIES.shopping);
    fixture.componentRef.setInput('deleting', true);

    component.onSubmit();

    expect(confirmed).toEqual([]);
  });
});
