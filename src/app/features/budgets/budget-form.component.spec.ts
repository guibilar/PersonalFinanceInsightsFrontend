import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BudgetFormComponent } from './budget-form.component';
import { BudgetInputDto } from '../../core/models/inputs/budget-input-dto';
import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { Status } from '../../core/models/enums/status';
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

  it('rejects blank text and non-positive amounts', () => {
    create();

    component.form.setValue({
      name: '   ',
      description: 'Food',
      amount: 0,
      status: Status.Active,
      period: BudgetPeriod.Total,
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
});
