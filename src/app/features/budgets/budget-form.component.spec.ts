import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BudgetFormComponent } from './budget-form.component';
import { BudgetInputDto } from '../../core/models/inputs/budget-input-dto';
import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { Status } from '../../core/models/enums/status';
import { TEST_CATEGORIES, TEST_CATEGORY_LIST } from '../../testing/test-categories';
import { BudgetPeriod } from '../../core/models/enums/budget-period';

describe('BudgetFormComponent', () => {
  let fixture: ComponentFixture<BudgetFormComponent>;
  let component: BudgetFormComponent;
  let submitted: BudgetInputDto[];

  function create(budget: BudgetOutputDto | null = null) {
    TestBed.configureTestingModule({
      imports: [BudgetFormComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(BudgetFormComponent);
    fixture.componentRef.setInput('budget', budget);
    fixture.componentRef.setInput('categories', TEST_CATEGORY_LIST);
    component = fixture.componentInstance;
    submitted = [];
    component.submitBudget.subscribe((value) => submitted.push(value));
    fixture.detectChanges();
  }

  it('starts invalid and does not submit', () => {
    create();

    component.onSubmit();

    expect(component.form.invalid).toBe(true);
    expect(submitted).toEqual([]);
  });

  it('limits names to 100 and descriptions to 500 characters, like the API', async () => {
    create();
    const el = fixture.nativeElement as HTMLElement;
    const at = (n: number) => 'x'.repeat(n);

    component.form.patchValue({ name: at(100), description: at(500) });
    expect(component.form.controls.name.valid && component.form.controls.description.valid).toBe(
      true,
    );

    component.form.patchValue({ name: at(101), description: at(501) });
    component.form.markAllAsTouched();
    await fixture.whenStable();

    expect(component.form.controls.name.hasError('maxlength')).toBe(true);
    expect(component.form.controls.description.hasError('maxlength')).toBe(true);
    expect(el.querySelector('#budget-name')!.getAttribute('maxlength')).toBe('100');
    expect(el.textContent).toContain('At most 100 characters.');
    expect(el.textContent).toContain('At most 500 characters.');
  });

  it('rejects blank text and non-positive amounts', () => {
    create();

    component.form.setValue({
      name: '   ',
      description: 'Food',
      amount: 0,
      status: Status.Active,
      period: BudgetPeriod.Total,
      categoryIds: [],
    });

    expect(component.form.controls.name.invalid).toBe(true);
    expect(component.form.controls.amount.invalid).toBe(true);
  });

  it('emits a trimmed DTO for a new budget', () => {
    create();

    component.form.setValue({
      name: ' Food ',
      description: ' Groceries ',
      amount: 300,
      status: Status.Inactive,
      period: BudgetPeriod.Monthly,
      categoryIds: [TEST_CATEGORIES.dining.id],
    });
    component.onSubmit();

    expect(submitted).toEqual([
      {
        id: '',
        name: 'Food',
        description: 'Groceries',
        amount: 300,
        status: Status.Inactive,
        period: BudgetPeriod.Monthly,
        categoryIds: [TEST_CATEGORIES.dining.id],
      },
    ]);
  });

  it('prefills and keeps the id when editing', () => {
    create({
      id: 'b1',
      name: 'Food',
      description: 'Groceries',
      status: Status.Inactive,
      period: BudgetPeriod.Monthly,
      categories: [TEST_CATEGORIES.groceries],
      totalAmount: 500,
      totalSpent: 0,
      totalRemaining: 500,
      percentageUsed: 0,
    });

    expect(component.isEditing()).toBe(true);
    expect(component.form.getRawValue()).toEqual({
      name: 'Food',
      description: 'Groceries',
      amount: 500,
      status: Status.Inactive,
      period: BudgetPeriod.Monthly,
      categoryIds: [TEST_CATEGORIES.groceries.id],
    });

    component.onSubmit();
    expect(submitted[0].id).toBe('b1');
  });

  it('defaults new budgets to Total and offers both periods as radio buttons', () => {
    create();

    const radios = fixture.nativeElement.querySelectorAll(
      'input[type=radio][formcontrolname=period]',
    );

    expect(component.form.controls.period.value).toBe(BudgetPeriod.Total);
    expect(radios.length).toBe(2);
    (radios[1] as HTMLInputElement).click();
    expect(component.form.controls.period.value).toBe(BudgetPeriod.Monthly);
  });

  it('offers the categories only for a monthly budget, and clears them when it turns total', () => {
    create();
    const root = fixture.nativeElement as HTMLElement;
    const boxes = () => root.querySelectorAll('input[id^=budget-category-]');

    expect(boxes().length).toBe(0);

    component.form.controls.period.setValue(BudgetPeriod.Monthly);
    fixture.detectChanges();
    expect(boxes().length).toBe(TEST_CATEGORY_LIST.length);
    component.toggleCategory(TEST_CATEGORIES.dining.id, true);
    component.toggleCategory(TEST_CATEGORIES.groceries.id, true);
    component.toggleCategory(TEST_CATEGORIES.dining.id, false);
    expect(component.form.controls.categoryIds.value).toEqual([TEST_CATEGORIES.groceries.id]);

    component.form.controls.period.setValue(BudgetPeriod.Total);
    fixture.detectChanges();
    expect(component.form.controls.categoryIds.value).toEqual([]);
    expect(boxes().length).toBe(0);
  });

  it("keeps an edited budget's own categories on offer while the list is loading", () => {
    create({
      id: 'b1',
      name: 'Food',
      description: 'Groceries',
      status: Status.Active,
      period: BudgetPeriod.Monthly,
      categories: [TEST_CATEGORIES.groceries],
      totalAmount: 500,
      totalSpent: 0,
      totalRemaining: 500,
      percentageUsed: 0,
    });
    fixture.componentRef.setInput('categories', []);
    fixture.detectChanges();

    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('label[for^=budget-category-]'),
    ).map((l) => l.textContent!.trim());
    expect(labels).toEqual(['Groceries']);
    expect(component.isCategoryChosen(TEST_CATEGORIES.groceries.id)).toBe(true);
  });
});
