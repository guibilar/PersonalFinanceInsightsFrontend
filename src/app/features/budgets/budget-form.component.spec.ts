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
      startDate: '',
      endDate: '',
      categoryIds: [],
      merchant: '',
    });

    expect(component.form.controls.name.invalid).toBe(true);
    expect(component.form.controls.amount.invalid).toBe(true);
  });

  it('caps the amount at the API maximum of 1,000,000,000, and says so', () => {
    create();
    const { amount } = component.form.controls;

    amount.setValue(1_000_000_000);
    expect(amount.valid).toBe(true);

    amount.setValue(1_000_000_001);
    amount.markAsTouched();
    fixture.detectChanges();
    expect(amount.hasError('max')).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Amount can be at most 1,000,000,000.',
    );
  });

  it('emits a trimmed DTO for a new budget', () => {
    create();

    component.form.setValue({
      name: ' Food ',
      description: ' Groceries ',
      amount: 300,
      status: Status.Inactive,
      period: BudgetPeriod.Monthly,
      startDate: '',
      endDate: '',
      categoryIds: [TEST_CATEGORIES.dining.id],
      merchant: '',
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
      startDate: '',
      endDate: '',
      categoryIds: [TEST_CATEGORIES.groceries.id],
      merchant: '',
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
    expect(radios.length).toBe(4);
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

  describe('yearly, custom and merchant budgets', () => {
    const root = () => fixture.nativeElement as HTMLElement;
    const field = (id: string) => root().querySelector<HTMLInputElement>(`#${id}`)!;
    const fill = (value: Partial<ReturnType<typeof component.form.getRawValue>>) => {
      component.form.patchValue({ name: 'Food', description: 'd', amount: 100, ...value });
      fixture.detectChanges();
    };

    it('counts categories or a merchant in any period but total', () => {
      create();
      expect(field('budget-merchant')).toBeNull();

      component.form.controls.period.setValue(BudgetPeriod.Yearly);
      fixture.detectChanges();
      expect(field('budget-merchant')).not.toBeNull();
      expect(root().querySelectorAll('input[id^=budget-category-]').length).toBe(
        TEST_CATEGORY_LIST.length,
      );

      component.form.controls.period.setValue(BudgetPeriod.Total);
      component.form.controls.merchant.setValue('no frills');
      fixture.detectChanges();
      component.form.controls.period.setValue(BudgetPeriod.Monthly);
      fixture.detectChanges();
      expect(component.form.controls.merchant.value).toBe('no frills');

      component.form.controls.period.setValue(BudgetPeriod.Total);
      expect(component.form.controls.merchant.value).toBe('');
    });

    it('lets a merchant lock the categories, and categories lock the merchant', () => {
      create();
      component.form.controls.period.setValue(BudgetPeriod.Monthly);
      fixture.detectChanges();

      component.form.controls.merchant.setValue(' no frills ');
      fixture.detectChanges();
      expect(
        root()
          .querySelector('fieldset[aria-describedby=budget-categories-hint]')!
          .hasAttribute('disabled'),
      ).toBe(true);
      expect(root().textContent).toContain('Clear the merchant to count categories instead.');

      component.form.controls.merchant.setValue('');
      component.toggleCategory(TEST_CATEGORIES.dining.id, true);
      fixture.detectChanges();
      expect(field('budget-merchant').disabled).toBe(true);
      expect(root().textContent).toContain('Untick the categories to count a merchant instead.');
    });

    it('asks for both days of a custom period, the last not before the first', () => {
      // Typed into the fields, as a person would: that is what redraws the messages.
      const type = (id: string, value: string) => {
        field(id).value = value;
        field(id).dispatchEvent(new Event('input'));
        field(id).dispatchEvent(new Event('blur'));
        fixture.detectChanges();
      };
      const message = () => root().querySelector('[role=alert]')?.textContent ?? '';
      create();
      fill({ period: BudgetPeriod.Custom });
      expect(field('budget-start')).not.toBeNull();
      expect(component.form.hasError('daysMissing')).toBe(true);
      expect(message()).toBe('');

      type('budget-start', '2026-07-01');
      expect(component.form.invalid).toBe(true);
      expect(message()).toContain('Choose the first');

      type('budget-end', '2026-06-30');
      expect(component.form.hasError('daysOrder')).toBe(true);
      expect(message()).toContain('can’t be before');

      type('budget-end', '2026-07-01');
      expect(component.form.valid).toBe(true);
      expect(message()).toBe('');
    });

    it('says nothing while a year is typed, and asks for the full year once the field is left half-typed', () => {
      const root = () => fixture.nativeElement as HTMLElement;
      const message = () => root().querySelector('[role=alert]')?.textContent ?? '';
      create();
      fill({ period: BudgetPeriod.Custom, startDate: '2026-07-01' });
      component.form.controls.startDate.markAsTouched();

      for (const day of ['0002-07-31', '0020-07-31', '0202-07-31']) {
        component.form.controls.endDate.setValue(day);
        fixture.detectChanges();
        expect(component.form.invalid).toBe(true);
        expect(message()).toBe('');
      }

      // Create is disabled meanwhile, so leaving the field is when it says why.
      expect(root().querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true);
      component.form.controls.endDate.markAsTouched();
      fixture.detectChanges();
      expect(message()).toContain('Enter the full year');

      component.onSubmit();
      fixture.detectChanges();
      expect(submitted).toEqual([]);
      expect(message()).toContain('Enter the full year');

      component.form.controls.endDate.setValue('2026-07-31');
      fixture.detectChanges();
      expect(component.form.valid).toBe(true);
      expect(message()).toBe('');
    });

    it('sends the days of a custom period and a trimmed merchant, and only those', () => {
      create();
      fill({
        period: BudgetPeriod.Custom,
        startDate: '2026-07-01',
        endDate: '2026-08-15',
        merchant: ' restaurant ',
      });
      component.onSubmit();

      fill({ period: BudgetPeriod.Yearly });
      component.onSubmit();

      expect(submitted).toEqual([
        expect.objectContaining({
          period: BudgetPeriod.Custom,
          startDate: '2026-07-01',
          endDate: '2026-08-15',
          merchant: 'restaurant',
        }),
        expect.objectContaining({ period: BudgetPeriod.Yearly, merchant: 'restaurant' }),
      ]);
      expect(submitted[1].startDate).toBeUndefined();
      expect(submitted[1].endDate).toBeUndefined();
    });

    it('prefills the days and merchant of an edited budget', () => {
      create({
        id: 'b1',
        name: 'Holiday food',
        description: 'd',
        status: Status.Active,
        period: BudgetPeriod.Custom,
        startDate: '2026-07-01T00:00:00Z',
        endDate: '2026-08-15T00:00:00Z',
        merchant: 'restaurant',
        categories: [],
        totalAmount: 300,
        totalSpent: 0,
        totalRemaining: 300,
        percentageUsed: 0,
      });

      expect(component.form.getRawValue()).toEqual(
        expect.objectContaining({
          startDate: '2026-07-01',
          endDate: '2026-08-15',
          merchant: 'restaurant',
        }),
      );
      expect(field('budget-start').value).toBe('2026-07-01');
    });
  });
});
