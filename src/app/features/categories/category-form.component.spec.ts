import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CATEGORY_PALETTE, CategoryFormComponent } from './category-form.component';
import { CategoryInputDto } from '../../core/models/inputs/category-input-dto';
import { CategoryOutputDto } from '../../core/models/outputs/category-output-dto';
import { TEST_CATEGORIES, TEST_CATEGORY_LIST } from '../../testing/test-categories';

describe('CategoryFormComponent', () => {
  let fixture: ComponentFixture<CategoryFormComponent>;
  let component: CategoryFormComponent;
  let submitted: CategoryInputDto[];

  const root = () => fixture.nativeElement as HTMLElement;

  function create(category: CategoryOutputDto | null, categories = TEST_CATEGORY_LIST) {
    TestBed.configureTestingModule({
      imports: [CategoryFormComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(CategoryFormComponent);
    fixture.componentRef.setInput('category', category);
    fixture.componentRef.setInput('categories', categories);
    component = fixture.componentInstance;
    submitted = [];
    component.submitCategory.subscribe((value) => submitted.push(value));
    fixture.detectChanges();
  }

  it('starts a new category on a colour no category has yet', () => {
    // The fixture's categories use the first palette colour (#1F76B5) and others; the second is free.
    create(null, [TEST_CATEGORIES.dining]);

    expect(component.form.controls.color.value).toBe(CATEGORY_PALETTE[1]);
  });

  it('adds a category with a trimmed name and the colour upper-case', () => {
    create(null);
    component.form.patchValue({ name: '  Coffee ', color: '#6f4e37' });

    component.onSubmit();

    expect(submitted).toEqual([{ name: 'Coffee', color: '#6F4E37' }]);
  });

  it('picks a colour from the swatches, and marks the one picked', async () => {
    create(null);
    const swatches = () => Array.from(root().querySelectorAll<HTMLButtonElement>('.swatch'));

    swatches()[3].click();
    await fixture.whenStable();

    expect(component.form.controls.color.value).toBe(CATEGORY_PALETTE[3]);
    expect(swatches().filter((s) => s.getAttribute('aria-pressed') === 'true')).toEqual([
      swatches()[3],
    ]);
  });

  it('shows how it will look', async () => {
    create(null);
    component.form.patchValue({ name: 'Coffee' });
    await fixture.whenStable();

    expect(root().textContent).toContain('It shows as Coffee in lists and charts.');
  });

  it('edits the name and colour', () => {
    create(TEST_CATEGORIES.groceries);

    expect(component.form.getRawValue()).toEqual({ name: 'Groceries', color: '#2CA12D' });
    component.form.patchValue({ name: 'Food', color: '#00AA00' });
    component.onSubmit();

    expect(submitted).toEqual([{ name: 'Food', color: '#00AA00' }]);
  });

  it('needs a name of at most 50 characters and a colour', async () => {
    create(null);
    component.form.controls.name.setValue('  ');
    component.onSubmit();
    component.form.controls.name.setValue('x'.repeat(51));
    component.onSubmit();
    component.form.patchValue({ name: 'Coffee', color: 'red' });
    component.onSubmit();
    await fixture.whenStable();

    expect(submitted).toEqual([]);
  });
});
